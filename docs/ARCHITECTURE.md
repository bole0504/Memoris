# Memoris — Architecture

## 1. The golden rule

**Capture surface ≠ brain.** Never couple the brain to one surface.

```
        Capture surfaces  ──────┐
                                │
  [Browser Extension]  (v1)     │
  [Desktop app: OS-wide hotkey] ├──> ONE BRAIN  ──> Projections
  [Mobile share-sheet]          │    (core store     - Obsidian markdown
  [IDE plugin]                  │     + AI)           - dashboard
        ───────────────────────┘                     - (future) mobile/web app
```

- **v1 = browser extension** (richest context: URL, DOM, surrounding text; ICP lives in the
  browser — GitHub, Confluence, StackOverflow, Slack web, ChatGPT/Claude web ≈ 80% of need).
- **Designed as a thin client** so a **desktop app (OS-wide hotkey)** can be added later to cover
  native apps (Slack desktop, Claude desktop, IDE, PDF) — captured via Accessibility API /
  clipboard, with screenshot+OCR fallback.

## 2. Request flow (local-first, miss → server)

"Local search" is **two tiers**, because there are two kinds of "already seen":

```
User selects text
   │
   ▼
[Tier 0] Exact-match cache (local)      → hit: return <50ms, NO AI call, +1 encounter
   │ miss
   ▼
[Tier 1] Semantic search (local, embedding) → hit (sim > threshold): return existing concept
   │ miss / low similarity                      + "you've seen this concept"
   ▼
[Tier 2] Server (real AI)               → analyze; store new encounter; async embed + link
```

**Latency budget:** Tier 0 < 50ms · Tier 1 < 150ms · Tier 2 target < 800ms.
(We compete with `Cmd-C → ChatGPT`. Slower = we lose.)

Rules:
- Tiers 0 & 1 **must work offline** → this is *why* the brain is a local store, not the server.
- **Always log an encounter, even on a hit** — the "translated this 6 times" signal (the
  emotional hook) comes from counting encounters, not from AI calls.
- A cache miss ≠ "never seen." It only means no analysis is cached.

## 3. AI gateway + model routing

The extension **always calls our gateway server**, never an LLM provider directly.

```
Extension ──> Gateway (ours) ──> Model A / B / C
                  │
                  ├─ holds API keys (NEVER in the client)
                  ├─ router: pick model per task type
                  ├─ server-side cache (same question across users)
                  ├─ rate-limit / quota / cost control per plan
                  └─ swap models without shipping a new extension
```

Why a gateway: key security, swap models freely, control cost (AI is the biggest variable cost).

**Model routing — never one model for everything:**

| Task | Model tier | Why |
|---|---|---|
| Translate + 1-line gloss (fast Tier 2) | small / cheap | high volume, must be fast |
| Tone + grammar + "why this wording" | medium | lazy-loaded, only when user opens it |
| **Curation** ("worth remembering?") | model + a learned classifier | this is the moat |
| Link / merge / profile (async, background) | batch, cheap | not real-time |

> MVP note: **do not ship a local model in v1.** It's heavy on the user's machine and slows
> launch. Start with the gateway + a cheap cloud model for the fast tier. A local model is a
> *privacy-selling* feature for later.

## 4. AI pipeline (cheap → expensive stages)

1. **Analyze** (per selection, latency-critical) — small fast model: translation + gloss; tone/
   grammar/why on demand.
2. **Curate** (the moat) — decide *worth remembering?* from novelty (embedding distance),
   frequency, user profile, source importance. A learned, personalized policy — not just a prompt.
3. **Link & merge** (async, batched) — embed concept, find neighbors, dedup, propose typed edges.
4. **Profile** (slow, background) — infer profession, recurring topics, confusion pairs from the
   encounter log.
5. **Schedule** — spaced-repetition timing modulated by real-world re-exposure.

## 5. Paragraph translation (not just single words)

**Principle: a paragraph is CONTEXT, not a CONCEPT.** Never store a whole paragraph as one
reviewable unit.

```
User selects a PARAGRAPH
   │
   ▼ (1) Translate & show the whole paragraph NOW   ← primary need; optimize latency
   │
   ▼ (2) AI EXTRACTS "worth-remembering units": terms, idioms, phrasal verbs,
   │      collocations, unusual grammar → highlight them on the translated paragraph
   │
   ▼ (3) User taps to SAVE chosen units → each becomes a CONCEPT
          linked back to the ENCOUNTER (the paragraph) as its original context
```

- **Encounter** = stores the **whole paragraph** + translation + source (the "original context"
  replayed in review).
- **Concept** = only the extracted + chosen units; each points back to its encounter.
- **Which units to extract** (do NOT extract everything — noise): novelty, difficulty relative
  to the user's profile, frequency, whether it's domain jargon. AI *proposes*, user *decides*.

## 6. Private pages (e.g. Jira) & degraded context

- The extension runs in the user's browser with their session → it **can read** the Jira content
  the user is viewing. The issue is not *reading*, it's whether to **send** it to server/AI.
- **Per-domain privacy toggle:** allow disabling "send content to cloud" for sensitive domains
  (`jira.company.com`) → local-only mode or skip. This is a **selling point**, not a limitation.
- Send **only selected text + minimal surrounding context**, never the whole page. Never store
  URLs/identifiers that leak secrets.
- **When full context is unavailable** (privacy mode, or canvas-rendered apps where DOM text is
  unreadable): **degrade gracefully** — work with selection + app/domain name; AI analysis is more
  generic; mark the encounter `low_context`. Desktop app later adds screenshot+OCR fallback.

## 7. Tech stack

### Extension
- **WXT** (Manifest V3 framework — best DX, multi-browser build) + **React** + **TypeScript** +
  **Tailwind**.
- **Shadow DOM** for the popover (so host-page CSS — GitHub/Jira/etc. — can't break our UI).
- Token storage in **`chrome.storage.local`** (NOT page `localStorage`).

### Server (gateway)
- **Fastify + TypeScript + Prisma** — lean, one language across extension & server, reusable types.
- **Auth:** Google OAuth (fastest for MVP) → JWT **access token (~15 min) + refresh token**.
  - JWT authenticates the **user**, not the app. That's expected and sufficient — don't build
    client attestation for the MVP.
  - Per-user rate-limit at this layer (abuse + AI-cost protection).
- **Server DB:** **SQLite on the server** for users/quota/billing (tiny RAM, no separate DB
  process). MongoDB/Postgres only later, for cloud sync / cross-user aggregates.

### Dashboard
- **Vite + React (static SPA)** — NOT Next.js SSR (SSR is heavy on a tiny VPS).
- Built off-box, served as static files by **nginx**, talks to the same API.
- Shows: concepts stored, streaks, top words, usage/quota, billing. Also where the user *feels
  their memory grow* — a retention lever.

### Local brain
- Source of truth = **own store**, not Obsidian.
- v0 (in-extension): **IndexedDB** (simplest in the browser sandbox) or SQLite-WASM (OPFS).
- Full brain (Obsidian plugin / desktop app, which run on Node/Electron): **SQLite +
  `sqlite-vec`** (local vector search) + **JSON columns** for flexible/evolving fields +
  **Prisma** for painless migrations.

## 8. Data model

Four object types (source of truth; Obsidian markdown is a *projection* of these):

- **Encounter** — a single capture event (raw selection, URL, app, timestamp, surrounding
  context, AI analysis). Immutable log. *A selected paragraph is stored here.*
- **Concept** — the durable unit (word, phrase, idiom, or idea like "technical debt"). Many
  encounters → one concept. Carries embedding, mastery score, review state.
- **Link** — a **typed** edge between concepts: `is-a`, `confused-with`, `co-occurs`,
  `prerequisite-of`, `synonym-of`. Typed, not Obsidian's mushy bidirectional link.
- **Source** — GitHub/Slack/etc., with metadata for context recreation in review.

### Obsidian projection (one file per Concept, not per encounter)

```markdown
---
concept: idempotent
type: term
language: en
mastery: 0.4
encounters: 4
first_seen: 2026-03-02
last_review: 2026-06-20
next_review: 2026-06-29
tags: [api-design, http, backend]
related: ["[[eventual-consistency]]", "[[retry-logic]]"]
confused_with: ["[[atomic]]"]
---

# idempotent
**Gloss:** an operation safe to repeat without changing the result beyond the first.

## Encounters
- 2026-03-02 · GitHub PR #4412 · "make the webhook handler idempotent" → [tone: directive]
- 2026-06-20 · Stripe docs · "idempotency keys prevent double charges"

## Why this wording
"Idempotent" not "repeatable" because it specifies *no additional side effects*…

## Your notes
(user-editable, NEVER overwritten by AI)
```

> **Engineering rule (or it kills us):** AI writes only to frontmatter / fenced regions; the
> user's section is sacred. Round-trip markdown parsing must be **lossless** or we corrupt vaults.

## 9. Knowledge graph

- **Engine, not a feature.** Don't sell the graph; use it.
- **Typed edges**, built from **embedding similarity + real co-occurrence in the user's
  encounters** (not a generic ontology). The graph is *theirs*.
- Earns its keep by powering retrieval & review (e.g. review co-occurring concepts together;
  detect confusion clusters to quiz). The user feels it through *better reviews*, not a node-link
  picture.

## 10. Memory system

- Every memory keyed to **embedding + encounter context** → retrieve "this idea in this
  situation," across different surface words.
- A **personal language model of the user**: confusion pairs, overused hedges, jargon mastery
  curve, topic distribution over time.
- Trust-building statements (cheap queries over the encounter log, the emotional hook): *"6th time
  translating this," "you confuse affect/effect," "this dominates your PR reviews."*
- **Real-world exposure decays review need** — if the world keeps teaching it, Memoris goes quiet.

## 11. Infra — the test VPS

DigitalOcean droplet `165.22.109.245` — **Basic / 1 vCPU / 512 MB RAM / 10 GB disk**.

> **This is RAM-tiny. Treat it as STAGING for a handful of users, not production.**

- **Create a 1–2 GB swap file** immediately (prevents OOM at peaks — mandatory).
- **Never build on the VPS** (the dashboard build will exhaust RAM and hang it) — build in CI /
  locally, deploy static artifacts only.
- **No DB server** on it (Mongo/Postgres would eat the RAM) — use **server-side SQLite**.
- Put **Cloudflare** in front (free: hides IP, caching, basic DDoS protection).
- Be ready to upgrade the moment real traffic arrives.
