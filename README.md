# Memoris

> Your second brain for working in a second language.
> It remembers the words, tone, and concepts you meet at work — so you stop re-learning them.

Memoris is **not** another translator, chatbot, or flashcard app. It is the **memory and
curation layer** that turns everyday translation moments into compounding, contextual
knowledge — a personal, connected knowledge graph that grows automatically out of your real work.

---

## The one-liner

Current translation tools (Google Translate, DeepL, ChatGPT) solve translation well, but
they have **no memory**. You translate the same term six times and learn nothing.
Traditional learning apps (Duolingo, Anki) have the opposite problem: they force you to
**stop working and "go learn"** — a new habit most people abandon.

Memoris removes both problems: **learning happens automatically while you already work.**
Translation is the input. Learning is the side effect.

## Who it is for

The real ICP is **not** "language learners." It is the **non-native-English-speaking
knowledge worker** — disproportionately a software engineer — who already works in English
all day (GitHub, Slack, Confluence, Jira, StackOverflow, docs) and is quietly losing time
and confidence re-decoding the same jargon, idioms, and tone every day.

## Core principles

- **Capture > Create** — capture real exposure; don't create new study sessions.
- **Context > Vocabulary** — remember the idea-in-situation, not isolated words.
- **Knowledge Graph > Flashcards** — connected concepts, not flat lists.
- **Daily Workflow > Learning Sessions** — your browser is the classroom.
- **Memory > Translation** — the moat is accumulated personal knowledge.
- **AI Curator > AI Teacher** — the AI decides what is worth remembering.

> Pricing rule that follows from these: **never charge in a way that makes users capture or
> remember less.** Charge for amplification (sync, AI depth, smart review) — not for capturing.

---

## Documentation

| Doc | What's inside |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Vision, problem, ICP, user journey, business model, go-to-market, why-not-ChatGPT |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, request flow, capture surfaces, stacks, data model, AI gateway, privacy |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Key technical decisions and the reasoning behind them (ADR-style) |
| [docs/ROADMAP.md](docs/ROADMAP.md) | A→Z build roadmap, phase by phase, with milestones and exit criteria |

## Status

**MVP loop working — Phases 0–3 + 5 done and verified.** Select text → translate + explain →
Remember → it's saved locally with context → "seen N×" → contextual review → dashboard shows your
memory growing. Each phase was shipped only after the self-verification harness passed
(`node harness/ship-phase.mjs <n>`). See [docs/ROADMAP.md](docs/ROADMAP.md).

| Phase | What | Status |
|---|---|---|
| 0 | Foundation & setup | ✅ verified |
| 1 | Aha capture loop (Gemini translate + Remember) | ✅ verified (live Gemini) |
| 2 | Memory & curation (tiers, dedup/merge, links, LLM rubric, privacy) | ✅ verified (live Gemini) |
| 3 | Contextual review (source-replay micro-review, weak/confusion) | ✅ verified |
| 5 | Dashboard, accounts, quota | ✅ verified |
| 4 | Obsidian projection | deferred — needs a real vault + lossless round-trip |

## Repo layout

```
apps/
  server/      Fastify + Prisma + SQLite AI gateway (Gemini): auth, analyze, embed, curate, quota
  extension/   WXT + React + Tailwind (MV3): Shadow-DOM popover, IndexedDB brain, inline review
  dashboard/   Vite + React static SPA: stats, streaks, top words, usage/quota, plan
packages/
  shared/      Shared TypeScript types (Encounter, Concept, Link, Source, API contracts)
  core/        The brain — surface-agnostic: tiers, curation, dedup/merge, review scheduler
harness/       Self-verification: verify-phase.mjs (gates + live AC) · ship-phase.mjs (verify→push)
deploy/        VPS prep, nginx config, prebuilt-artifact deploy script
docs/          Product, architecture, decisions, roadmap
```

## Development

Requires Node ≥ 20 and pnpm.

```bash
pnpm install

# Server gateway — http://localhost:3000/health
cp apps/server/.env.example apps/server/.env   # then set GEMINI_API_KEY + JWT_SECRET
pnpm --filter @memoris/server prisma:generate
pnpm --filter @memoris/server db:push
pnpm dev:server

# Extension (loads at .output/chrome-mv3 → chrome://extensions → Load unpacked)
pnpm dev:extension     # then click the toolbar icon → sign in (dev email) → select text anywhere

# Dashboard — http://localhost:5173 (proxies /v1 + /health to the server)
pnpm dev:dashboard
```

Workspace-wide: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

### Self-verification harness

Each roadmap phase has machine-checked acceptance criteria. The harness runs static gates
(typecheck, lint, unit tests, build) plus live acceptance checks (boots the server, hits the
endpoints, calls Gemini for real), and only commits + pushes if everything passes.

```bash
pnpm verify 5                                   # verify through Phase 5
node harness/ship-phase.mjs 5 "commit subject"  # verify, then commit + push only on PASS
```

### Notes / deferred

- **AI model:** Gemini `gemini-2.5-flash-lite` (cheapest with free-tier quota; `2.0-flash-lite`
  has a 0 free-tier limit) and `gemini-embedding-001` for vectors. The key lives only on the
  gateway. Configure via `apps/server/.env`.
- **Auth:** MVP uses a dev email login (fully self-verifiable, no external setup). Google OAuth
  plugs into the same token issuance once a client id is configured.
- **Billing:** Free↔Pro quota path is wired and enforced; Stripe Checkout is a `501` placeholder.
- **Dashboard stats** are counts only, pushed by the extension — concept *content* stays local.
- **Phase 4 (Obsidian)** is intentionally deferred: it needs a real vault and lossless markdown
  round-trip that can't be auto-verified headlessly (roadmap risk #2).

## MVP at a glance

- **Capture surface:** Chrome/Firefox browser extension (Manifest V3).
- **Local brain:** local store of encounters + concepts (IndexedDB in v0; SQLite + `sqlite-vec`
  once the Obsidian plugin / desktop app exists).
- **Server:** thin gateway — auth (Google OAuth + JWT), AI model routing, user/quota/billing.
- **Target:** English comprehension for non-native speakers (start with 2–3 native languages).
