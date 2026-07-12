# Memoris — Start here (re-orient in 5 minutes)

The one page to refresh your memory on the whole project. Deep-dives link to `docs/`.

## What it is (business)
Memoris is a **second brain for working in a second language**. Not a translator or flashcard app —
the **memory + curation layer** that turns everyday translation into lasting, connected knowledge.
- **ICP:** non-native-English knowledge workers (esp. software engineers) who work in English all day.
- **Wedge:** select text anywhere → translate + explain → "Remember" → it's saved with its real
  source; later you see "seen N× / related words / where you met it" and review in context.
- **Moat:** the accumulated, personal, connected knowledge graph — not translation.
- **Model (planned):** free = unlimited local capture + daily AI cap; Pro = unlimited AI + sync.
- Full vision: [docs/PRODUCT.md](docs/PRODUCT.md).

## Status (as of 2026-07)
- Core loop, memory/curation, contextual review, Obsidian projection, dashboard, provider
  abstraction, in-extension Knowledge page + graph — **all built & harness-verified**.
- **Live gateway:** `https://api.flashcard.io.vn` (HTTPS via Let's Encrypt on the VPS).
- **Security done:** HTTPS, port 3000 closed, public `/privacy`, first-run consent, secret-skip,
  OpenRouter no-logging. Google OAuth **coded but off** (env-gated).
- **Auth now:** silent anonymous sign-in (no login UI) — "just open and use".
- Roadmap + priorities: [docs/ROADMAP.md](docs/ROADMAP.md).

## How it works (architecture)
```
Browser
  ├─ Content script: select text → "M" icon → popover (translate + Remember)
  └─ Popup: paste-to-translate, Review, "My Knowledge" page (browse/edit/graph)
        │  (both talk to ↓ via messages)
  └─ Background service worker  ── OWNS the brain (IndexedDB) + all network
        │  https + JWT
Gateway (VPS, Fastify)  ── auth · quota · Tier-0 cache · provider routing · stats · /privacy
        │
   OpenRouter (chat) / Gemini (embeddings)
```
- **The brain is LOCAL** (IndexedDB in the background worker): encounters, concepts, links,
  embeddings. Server only stores **accounts / quota / counts-only stats** — never your vocab content.
- The brain logic is framework-agnostic in **`packages/core`** (swap storage via `StorageAdapter`).
- Details + request flow + what the server stores: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
  [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md).

## Repo map
```
apps/server            Fastify gateway (auth, analyze/embed/curate, quota, cache, /privacy)
apps/extension         WXT + React MV3: content popover, popup, background brain, Knowledge page
apps/dashboard         Vite SPA (stats)
apps/obsidian-plugin   Markdown projection + local bridge
packages/core          The brain (tiers, curation, review, dedup, markdown, related/graph)
packages/shared        Shared TypeScript types
harness/               Self-verify + ship (verify-phase.mjs / ship-phase.mjs)
docs/                  PRODUCT · ARCHITECTURE · DECISIONS · ROADMAP · KNOWLEDGE · SECURITY · STORE · PRIVACY
release/extension/     Prebuilt unpacked extension (git pull + Load unpacked)
```

## Run / verify / deploy
```bash
pnpm install
pnpm dev:server          # gateway (needs apps/server/.env with OPENROUTER_API_KEY / GEMINI_API_KEY)
pnpm dev:extension       # dev extension (points at localhost); prod build → release/ points at the domain
node harness/verify-phase.mjs 5           # run all acceptance checks
node harness/ship-phase.mjs 5 "message"   # verify → refresh release/ → commit → push (on PASS only)
./deploy/deploy.sh       # build locally, ship prebuilt to the VPS (binds 127.0.0.1 behind nginx)
```

## Key decisions (the "why")
- **Local-first brain** (privacy, offline, speed); server is a thin relay + accounts. Durability
  safety-net via `storage.persist` + backup; cloud sync deferred (chose it as the future path).
- **Provider abstraction** (`apps/server/src/llm.ts`): OpenRouter when keyed, else Gemini — swap by
  env, no code change. Use paid models (`:free` are heavily rate-limited).
- **Anonymous auth** for zero-friction beta; Google OAuth ready to switch on.
- Verified-then-push discipline via the harness. More: [docs/DECISIONS.md](docs/DECISIONS.md).

## When you forget something
Just ask Claude Code in this repo ("how does the review scheduler work?", "why anon auth?") — it
reads the code + these docs and answers with real file references. That's your best "understand
everything", because it knows the code AND the decisions/business above.
