# Memoris — Pre-launch Security & Privacy Checklist

Status toward a public Chrome Web Store release. 🔴 = blocks launch, 🟠 = should fix, 🟡 = nice.

| # | Item | Status |
|---|---|---|
| 1 | 🔴 **HTTPS/TLS** in front of the gateway (no plaintext) | ✅ nginx + Let's Encrypt at `https://api.flashcard.io.vn` (auto-renew) |
| 2 | 🔴 **Privacy Policy** published + linked in the store listing | ☐ ([docs/PRIVACY.md](PRIVACY.md) draft — fill contact + publish) |
| 3 | 🔴 **AI provider no-logging / no-training** configured + disclosed | ☐ (OpenRouter settings) |
| 4 | 🔴 Gateway bound to **127.0.0.1** (only nginx public); port 3000 closed | ✅ done |
| 5 | 🟠 **First-run consent** screen ("selecting text sends it to AI to translate") | ☐ |
| 6 | 🟠 **Secret-skip heuristic** (don't send things that look like passwords/tokens/keys) | ☐ |
| 7 | 🟠 Strong `JWT_SECRET` + real auth (Google OAuth) instead of dev email login | ☐ |
| 8 | 🟡 Tighten **CORS** to the extension id; shorten cache TTL | ☐ |
| 9 | 🟡 Rate-limit tuning + basic abuse monitoring | ☐ |

Already done: only selection + ≤280-char context sent (never full page); explicit click required
(no background scraping); per-domain private toggle; brain stays local; stats are counts-only; AI key
server-side; per-IP rate limit; per-user daily quota; `storage.persist` + backup.

---

## 1 + 4. HTTPS in front of the gateway

**Prerequisite: a domain** (e.g. `api.memoris.app`) pointing at the VPS. Pick ONE route:

### Option A — Let's Encrypt (real cert on the origin) — recommended
```bash
# On the VPS
sudo apt-get install -y nginx certbot python3-certbot-nginx

# nginx site: /etc/nginx/sites-available/memoris  (server_name = your domain)
```
```nginx
server {
    server_name api.memoris.app;          # ← your domain
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    client_max_body_size 256k;             # selections are tiny
    listen 80;
}
```
```bash
sudo ln -sf /etc/nginx/sites-available/memoris /etc/nginx/sites-enabled/memoris
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.memoris.app   # auto-adds TLS + redirect to 443
```

### Option B — Cloudflare in front (if the domain is on Cloudflare)
- DNS: A record `api` → VPS IP, **proxied** (orange cloud).
- SSL/TLS mode **Full (strict)** with an origin cert, or **Full** with the Let's Encrypt cert above.
- nginx same as Option A (listen 80/443).

### Then: close the plaintext port
```bash
# Bind Node to localhost only so :3000 isn't reachable from the internet:
#   in /opt/memoris/server/.env  →  HOST="127.0.0.1"
pm2 restart memoris-server
sudo ufw deny 3000/tcp     # if ufw active; also remove any DO firewall rule for 3000
curl https://api.memoris.app/health   # must return {"status":"ok",...}
```

### Point the extension at HTTPS
In `apps/extension/lib/config.ts`, set the production URL to `https://api.memoris.app`, rebuild
(`ship` refreshes `release/`), reload the extension.

---

## 3. AI provider no-logging / no-training

- **OpenRouter:** in account settings, disable prompt logging; prefer providers/models that offer
  **Zero-Data-Retention (ZDR)**. Our gateway already sends only the selection + minimal context.
- **Gemini (fallback/embeddings):** paid API tier is not used to train Google's models; the free
  tier may be. For production, use a billed key or ZDR-eligible routing.
- Disclose the chosen provider(s) in [PRIVACY.md](PRIVACY.md).

---

## 5–6. Client-side privacy (extension)

- **First-run consent:** a one-time screen explaining that selecting text + clicking sends it to an
  AI provider to translate, with a link to the Privacy Policy.
- **Secret-skip heuristic:** before sending, skip/warn when the selection matches patterns like
  API keys (`sk-…`, `AKIA…`), JWTs, long hex/base64 blobs, `password=`, credit-card-like numbers.
