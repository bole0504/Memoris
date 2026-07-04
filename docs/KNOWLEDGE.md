# Memoris — Product Knowledge Base

Trạng thái thực tế của hệ thống (cập nhật 2026-07-04). Mô tả **đúng theo code hiện tại**, không phải
kế hoạch. Khi sửa hành vi, cập nhật lại file này.

---

## 1. Caching (bộ nhớ đệm)

Có **3 lớp** riêng biệt — đừng nhầm lẫn:

| Lớp | Ở đâu | Mục đích | Có bỏ qua gọi AI không? |
|---|---|---|---|
| **Server Tier-0 cache** | RAM của gateway (`apps/server/src/cache.ts`, `TtlCache`) | Câu/từ **giống hệt** đã dịch → trả lại ngay | **Có** — không gọi AI, không trừ quota |
| **Client brain** | IndexedDB trong extension (background SW) | Lưu Encounter/Concept vĩnh viễn, đếm "seen N×", tìm Tier-0/Tier-1 | **Không** (xem lưu ý dưới) |
| **Capture stash** | `storage.session` của SW | Giữ tạm state 1 lần capture để nút "Remember" dùng lại | Không liên quan |

### Extension có cache không?
- **Có "bộ não" (IndexedDB)** nhưng nó KHÔNG dùng để bỏ qua việc gọi AI. Mỗi lần bấm icon → popover,
  extension **luôn gửi request `/v1/analyze` tới server** (xem `runCapture` trong
  `apps/extension/lib/capture-controller.ts` — luôn gọi `analyze` + `embed`).
- Việc "tiết kiệm gọi AI khi trùng" nằm ở **server Tier-0 cache**, không phải ở client.

### Dịch 1 từ trùng → lấy từ cache?
- **Có, ở phía server.** Route `/v1/analyze` kiểm tra cache theo key `"{targetLanguage}::{text.toLowerCase().trim()}"`
  TRƯỚC khi gọi AI/tính quota. Trùng → trả tức thì (popover hiện `⚡ cached (instant)`), **0 AI, 0 quota**.
- Client vẫn gửi 1 request mạng mỗi lần (nhưng server trả ngay từ cache nên rất nhanh).

### Khi nào cache bị xóa?
- **Server Tier-0 cache:** TTL **6 giờ**/entry; LRU tối đa **1000 entry** (đầy → bỏ cũ nhất); và **mất
  hết khi restart server** (`pm2 restart`) vì là in-memory.
- **Capture stash (session):** tối đa 20 entry; hết khi đóng trình duyệt.
- **Client brain (IndexedDB):** KHÔNG phải cache — **lưu vĩnh viễn**. Chỉ mất khi user xóa dữ liệu
  extension / gỡ extension (chưa có nút "xóa" trong UI).

---

## 2. Lưu trữ & mô hình dữ liệu

**Làm rõ hiểu nhầm phổ biến:** hiện **KHÔNG có SQLite ở phía client**. Phân bố thực tế:

| Kho | Công nghệ | Chứa gì | Ở đâu |
|---|---|---|---|
| **Bộ não (brain)** | **IndexedDB** (`idb`) | Encounter, Concept, Link (bộ nhớ từ vựng) | Trong extension (background service worker) |
| **Tài khoản/quota** | **SQLite (Prisma)** | User, UsageDay (quota), Stats (snapshot) | Trên **server** (`apps/server/prisma/dev.db`) |
| **Chiếu Obsidian** | **Markdown files** | 1 note/Concept + `[[wikilinks]]` | Vault Obsidian của user |

- SQLite chỉ tồn tại **trên server**, cho users/quota/stats — **không** giữ nội dung concept (nội dung ở
  local để bảo mật; server chỉ nhận **counts** cho dashboard qua `/v1/me/stats`).
- Roadmap Phase 4 từng dự tính `sqlite-vec` trong plugin Obsidian; hiện ta làm **markdown projection**
  (đơn giản, để Graph View hoạt động), chưa dùng sqlite-vec.

### Flow khi "có cache và (server) sqlite"
```
Bấm icon → Background SW:
  1. Gọi /v1/analyze (server)
     ├─ Server: verify JWT → check Tier-0 cache (RAM)
     │     ├─ hit  → trả ngay (0 AI, 0 quota)
     │     └─ miss → check quota (SQLite: UsageDay++) → gọi LLM → cache lại → trả
  2. Song song: /v1/embed (vector, best-effort)
  3. brain.lookup (IndexedDB): Tier-0 exact / Tier-1 semantic → "seen N×", concept liên quan
  4. brain.curate → verdict (new / seen / related)
Popover hiển thị. Bấm "Remember" → lưu Concept vào IndexedDB + (nền) push stats + sync Obsidian.
```
- **SQLite (server)** nằm ở bước quota; **IndexedDB (client)** ở bước 3–4; **cache (server)** ở bước 1.

---

## 3. Server: trách nhiệm & bảo mật

### Server làm gì (không chỉ proxy AI)
`apps/server` (Fastify) làm: **auth (JWT)** · **quota** theo user/ngày · **Tier-0 cache** ·
**provider routing + fallback** (OpenRouter/Gemini) · lưu **stats** · **rate-limit** theo IP · CORS ·
`/health`. Key AI **chỉ ở server**, không bao giờ ra client.

### Đang có sẵn (bảo vệ)
- **JWT bắt buộc** cho mọi `/v1/*` (trừ `/health`, `/v1/auth/*`).
- **Rate-limit theo IP:** 120 request/phút (`@fastify/rate-limit`).
- **Quota AI theo user:** free = 50 lookup/ngày (chặn tại gateway); Pro = unlimited.
- **Allowlist email cho dev-login** (tùy chọn `DEV_LOGIN_ALLOWED_EMAILS`).
- **API key server-side only.**

### Còn thiếu / nên làm (rủi ro hiện tại)
- **Chưa có HTTPS** — đang chạy HTTP `:3000` trần (bot internet đang quét). → nên bọc **nginx +
  Cloudflare** hoặc TLS.
- **dev-login mở:** nếu KHÔNG set allowlist, bất kỳ email nào cũng tạo được user + token (login = register).
- **Chưa giới hạn kích thước request** trực tiếp trên `:3000` (mặc định Fastify ~1MB; nginx có
  `client_max_body_size 1m` nhưng chỉ khi đi qua nginx).
- **JWT_SECRET mặc định yếu** — phải đặt secret mạnh (`openssl rand -hex 32`) trên production.
- **CORS đang mở `*`** — nên siết theo origin khi public.
- **Chưa có monitoring/alert, chưa có chống lạm dụng nâng cao** (CAPTCHA, chặn theo user bất thường).

---

## 4. Auth (đăng ký & đăng nhập)

**Hiện tại chỉ có 1 cách hoạt động thật:**
- **Dev email login** — `POST /v1/auth/dev { email }` → tạo/lấy user theo email (upsert) và trả
  **access token (~15') + refresh token (~30 ngày)**. **Không mật khẩu, không xác thực email** →
  thực chất **đăng nhập = đăng ký**. Có thể chặn bằng `DEV_LOGIN_ALLOWED_EMAILS`.
- **Refresh:** `POST /v1/auth/refresh { refreshToken }` → cấp access token mới.

**Đã chừa chỗ, CHƯA làm:**
- **Google OAuth** — có biến `GOOGLE_CLIENT_ID` (nếu set thì dev-login bị tắt), nhưng **luồng OAuth
  chưa được cài** → set vào lúc này sẽ khóa luôn đăng nhập. Chỉ bật khi đã code xong OAuth.

→ Tóm lại: **1 cách (dev email)**. Muốn cho người ngoài dùng thật nên làm **Google OAuth** (hoặc
email + mật khẩu + verify) trước.

---

## 5. AI provider (đã ổn định)

- `apps/server/src/llm.ts`: có `OPENROUTER_API_KEY` → dùng **OpenRouter** (`LLM_MODELS`, fallback nhiều
  model); không có → **Gemini**. Embeddings **luôn dùng Gemini**.
- Model `:free` của OpenRouter dùng pool chung → hay **429**; nên dùng model trả phí rẻ (vd
  `openai/gpt-4o-mini`) làm chính.
- Đổi provider/model = đổi `.env` + `pm2 restart`, **không sửa code**.

---

## 6. Public hoá extension (từ local → store)

Hiện extension chạy dạng **"Load unpacked"** (dev). Để phát hành:

**Chuẩn bị (bắt buộc):**
- **Trỏ về gateway production**: đổi mặc định `apiBaseUrl` (đang `http://localhost:3000`) sang URL
  server thật, **HTTPS**. (Hiện user tự nhập trong popup — public thì nên set mặc định.)
- **Auth thật** (Google OAuth) thay dev-login.
- **Icons** (16/32/48/128px), tên, version chuẩn trong manifest.
- **Privacy Policy** (bắt buộc vì extension đọc text người dùng) + mô tả rõ quyền `<all_urls>`.

**Chrome Web Store:**
1. Đăng ký **Developer account** (phí **$5** một lần).
2. Đóng gói: `pnpm --filter @memoris/extension zip` (WXT tạo file .zip).
3. Upload lên Developer Dashboard, điền listing (mô tả, ảnh chụp, category, privacy).
4. Nộp **review** — quyền `<all_urls>` + host broad → bị soi kỹ, giải trình mục đích.

**Firefox (AMO):** `pnpm --filter @memoris/extension zip -b firefox` rồi nộp trên addons.mozilla.org.

**Sau khi duyệt:** người dùng cài 1 click; cập nhật = tăng version + upload bản mới.

---

## 7. Khoảng trống đã biết (TODO)

- Client chưa có nút xóa/reset brain; chưa export/import UI ngoài JSON.
- Chưa client-side SQLite/sqlite-vec (đang IndexedDB) — nâng cấp tương lai nếu cần vector search mạnh.
- Chưa HTTPS/OAuth/Stripe thật (Stripe đang placeholder 501; plan Free/Pro đổi bằng dev endpoint).
- Dashboard stats chỉ là **counts** đẩy từ client; chưa realtime, chưa lịch sử.
- Obsidian: chưa test kỹ trên vault thật của user (đang chuẩn bị thử).

---

## Con trỏ nhanh tới code

| Chủ đề | File |
|---|---|
| Vòng capture (client) | `apps/extension/lib/capture-controller.ts` |
| Bộ não (client) | `packages/core/src/store.ts`, `apps/extension/lib/idb-adapter.ts` |
| Provider AI | `apps/server/src/llm.ts`, `gemini.ts` |
| Cache server | `apps/server/src/cache.ts`, `routes/analyze.ts` |
| Auth/quota | `apps/server/src/auth.ts`, `quota.ts`, `routes/auth.ts` |
| Obsidian projection | `packages/core/src/markdown.ts`, `apps/obsidian-plugin/` |
| Data model | `packages/shared/src/model.ts`, `apps/server/prisma/schema.prisma` |
