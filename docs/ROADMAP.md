# Memoris — Roadmap (A → Z)

> **Build status (2026-06-28):** Phases 0–5 implemented and harness-verified (Phase 4 = Obsidian
> graph projection, with the lossless round-trip done as the highest-risk piece). Each phase shipped
> only on `node harness/ship-phase.mjs <n>` PASS. Remaining: Phase 6 (private beta) and 7+ (future).


A phase-by-phase build plan from empty repo to a beta launch and beyond. Timeline assumes a
small team / solo founder + AI; adjust as needed. Each phase has a **goal**, **deliverables**, and
an **exit criterion** (what proves the phase is done).

> Sequencing principle: **prove the aha before building the moat.** Ship the smallest loop that
> makes a non-native dev say "it remembered, in context." Add Obsidian, the graph, and billing
> only after that lands.

---

## Phase 0 — Foundation & setup  ·  ~1 week
**Goal:** A repo, tooling, and a deployable skeleton.

- [ ] Monorepo (pnpm workspaces): `apps/extension`, `apps/server`, `apps/dashboard`, `packages/shared` (types).
- [ ] TypeScript config, ESLint/Prettier, shared types package.
- [ ] Server skeleton: **Fastify + TS + Prisma + SQLite**, `/health` endpoint.
- [ ] Extension skeleton: **WXT + React + TS + Tailwind**, content script that detects text selection.
- [ ] VPS prep (`165.22.109.245`): create **1–2 GB swap**, install nginx, Cloudflare in front,
      deploy pipeline that ships **prebuilt** artifacts (never build on-box).

**Exit:** extension loads in Chrome and logs a selection; server `/health` returns 200 from behind Cloudflare.

---

## Phase 1 — The aha capture loop  ·  ~2–3 weeks
**Goal:** Select → translate + explain → "Remember this" → it's saved with context. The 60-second aha.

- [ ] Selection → **popover in Shadow DOM** (host CSS can't break it).
- [ ] Server **AI gateway**: one cheap model; endpoint returns translation + 1-line gloss (Tier-2 fast).
- [ ] Lazy Tier-2 detail: tone, grammar, "why this wording," alternatives, examples (loads on expand).
- [ ] **Auth:** Google OAuth → JWT access + refresh; tokens in `chrome.storage.local`; per-user rate-limit.
- [ ] **Local store v0 (IndexedDB):** `Encounter` + `Concept`; one-tap "Remember this."
- [ ] Capture **source context** (URL/app/domain + surrounding text) with the encounter.
- [ ] Latency: Tier-1 translate target < 800ms.

**Exit:** a non-native dev selects a real PR sentence, gets a useful explanation, taps Remember,
and sees it saved with its source — end to end, on a deployed build.

---

## Phase 2 — Memory & curation (the moat)  ·  ~2–3 weeks
**Goal:** It stops being a translator and starts being a memory. "You've seen this N times."

- [ ] **Encounter logging on every lookup** (even cache hits) → the "translated 6×" signal.
- [ ] **Tier-0 exact-match cache** + **Tier-1 local semantic search** (embeddings; pick similarity threshold).
- [ ] **Embeddings**: generate per concept; store vectors (IndexedDB v0; `sqlite-vec` once on Node).
- [ ] **Curation engine v1**: "worth remembering?" from novelty (embedding distance) + frequency +
      simple profile. Heuristic + LLM rubric first; surface the verdict in the popover
      ("New concept — save?" / "Seen 4× — keep it?" / "Related to X you saved").
- [ ] **Dedup / merge** duplicate concepts; propose typed links (`co-occurs`, `confused-with`, ...).
- [ ] **Paragraph handling**: translate the whole paragraph; AI extracts worth-remembering units;
      user taps to save each (each links back to the paragraph encounter).
- [ ] **Privacy**: per-domain "don't send to cloud" toggle; `low_context` degradation path.

**Exit:** after a week of real use, Memoris correctly says "you've seen this before," dedups,
and links related concepts — and the user feels it knows their week.

---

## Phase 3 — Contextual review  ·  ~1.5–2 weeks
**Goal:** Review that doesn't feel like flashcards — micro, inline, context-replaying.

- [ ] **Spaced-repetition scheduler** (mastery + `next_review`), modulated by real-world re-exposure
      (keep meeting a word in the wild → back off quizzes).
- [ ] **Micro-review UI**: one item, ~5s, recall-based, replays the original sentence/source
      ("Today's review is from your real GitHub PR").
- [ ] **Weak-concept / confusion-pair detection** → targeted reviews.
- [ ] Review surfaced inline (popover / extension button), not a separate 20-min session.

**Exit:** daily contextual micro-reviews fire, each replaying real source context; review feels
like *your week*, not a deck.

---

## Phase 4 — Obsidian projection & the real brain  ·  ~2–3 weeks
**Goal:** Local-first, user-owned knowledge in Obsidian markdown; upgrade the brain to SQLite + vectors.

- [ ] **Obsidian plugin** (Node/Electron → native SQLite): writes one markdown file per Concept
      (frontmatter + encounters + why + sacred user-notes section).
- [ ] **Lossless round-trip** markdown parsing (AI writes only frontmatter/fenced regions; never
      touches user notes). *Highest-risk piece — test hard.*
- [ ] **SQLite + `sqlite-vec`** as the brain in the plugin; JSON columns for flexible fields; Prisma migrations.
- [ ] **Bridge**: browser extension → local companion / Obsidian plugin (localhost) so captures land
      in the brain. (Resolve the extension-can't-open-native-SQLite gap here.)
- [ ] Distribute via **Obsidian community plugins** (front door for the dev beachhead).

**Exit:** captures from the browser appear as connected markdown notes in Obsidian, with no vault
corruption across edit/round-trip cycles.

---

## Phase 5 — Accounts, dashboard, billing  ·  ~1.5–2 weeks
**Goal:** Turn it into a product people can pay for.

- [ ] **User management**: profiles, plan, quota tracking (AI lookups/day on free).
- [ ] **Dashboard** (Vite + React static SPA via nginx): concepts stored, streaks, top words,
      usage/quota, account/billing. The "watch your memory grow" retention surface.
- [ ] **Billing** (Stripe): Free vs Pro (~$8–12/mo). Free = unlimited local capture + daily AI cap;
      Pro = unlimited AI + cloud sync + advanced review + desktop app.
- [ ] **Enforce quotas** at the gateway (free daily AI cap; Pro unlimited).

**Exit:** a user can sign up, hit the free AI cap, upgrade to Pro via Stripe, and see their usage/stats.

---

## Phase 6 — Polish & private beta  ·  ~2 weeks
**Goal:** Ship to real non-native dev beta users and learn.

- [ ] Onboarding (60-second first-aha flow), empty states, error handling.
- [ ] Profile inference v1 (profession, recurring topics, confusion pairs).
- [ ] Performance pass (latency budgets), cost monitoring on the AI gateway.
- [ ] Recruit ~20–50 non-native dev beta users (Obsidian community, dev communities in VN/BR/IN/CN).
- [ ] Instrument: activation (first Remember), week-1 retention, lookups/day, review completion.

**Exit (MVP done):** beta users translate real work, retain captures, complete contextual reviews,
and say it beats `Cmd-C → ChatGPT`. Activation + week-1 retention metrics validate the loop.

---

## Phase 7+ — Beyond MVP (future)
Build only after the dev beachhead is validated.

- **Desktop app** (OS-wide hotkey) → covers Slack desktop, Claude desktop, IDE, PDF (Accessibility
  API / clipboard + screenshot-OCR fallback).
- **Mobile** (share-sheet capture, review on the go) — read from the same brain.
- **Curation classifier v2** — learned policy trained on aggregate behavior (deepens the moat).
- **Profile/memory v2** — richer personal language model; "you confuse X/Y," topic trends over time.
- **Cloud sync / multi-device** (the Pro lever that actually costs us → fair to charge for).
- **B2B / team plan** — shared company-jargon layer, non-native engineer onboarding (the real prize;
  data network effects).
- **More target languages & professions** — widen only after winning dev-English.
- **IDE plugin** — capture in the editor.

---

## Critical-path risks (watch these)
1. **Curation quality** — "worth remembering?" is the whole product. Spend the hardest engineering
   here (Phase 2), not on graph visuals.
2. **Lossless Obsidian round-trip** (Phase 4) — corrupting vaults would kill trust instantly.
3. **Capture latency** — must beat `Cmd-C → ChatGPT` or the wedge fails.
4. **Extension ↔ native-SQLite brain bridge** (Phase 4) — architectural unknown; prototype early.
5. **AI cost control** — model routing + caching + quotas from day one, or margins evaporate.

## Suggested first commit after this doc
Phase 0 scaffolding: monorepo + Fastify `/health` + WXT extension that captures a selection and
shows a stub popover. Then Phase 1 wires it to the AI gateway.
