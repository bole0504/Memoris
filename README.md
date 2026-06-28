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

**Phase 0 (Foundation & setup) — done.** Monorepo scaffolded; server `/health` and the
selection-capturing extension build and run. See [docs/ROADMAP.md](docs/ROADMAP.md) for the plan.

## Repo layout

```
apps/
  server/      Fastify + TS + Prisma + SQLite gateway (/health)
  extension/   WXT + React + TS + Tailwind (Manifest V3) — captures text selections
  dashboard/   Vite + React static SPA (built off-box, served by nginx)
packages/
  shared/      TypeScript types shared across all apps (Encounter, Concept, Link, Source, API)
deploy/        VPS prep, nginx config, prebuilt-artifact deploy script
docs/          Product, architecture, decisions, roadmap
```

## Development

Requires Node ≥ 20 and pnpm.

```bash
pnpm install

# Server gateway — http://localhost:3000/health
cp apps/server/.env.example apps/server/.env
pnpm --filter @memoris/server prisma:generate
pnpm --filter @memoris/server db:push
pnpm dev:server

# Extension (loads at .output/chrome-mv3 → chrome://extensions → Load unpacked)
pnpm dev:extension     # or: pnpm --filter @memoris/extension build

# Dashboard — http://localhost:5173 (proxies /health to the server)
pnpm dev:dashboard
```

Workspace-wide: `pnpm typecheck`, `pnpm lint`, `pnpm build`.

**Phase 0 exit check:** load the extension in Chrome, select text on any page → the capture is
logged to the page console; `curl http://localhost:3000/health` returns `{"status":"ok",...}`.

## MVP at a glance

- **Capture surface:** Chrome/Firefox browser extension (Manifest V3).
- **Local brain:** local store of encounters + concepts (IndexedDB in v0; SQLite + `sqlite-vec`
  once the Obsidian plugin / desktop app exists).
- **Server:** thin gateway — auth (Google OAuth + JWT), AI model routing, user/quota/billing.
- **Target:** English comprehension for non-native speakers (start with 2–3 native languages).
