# Memoris — Key Decisions (ADR-style)

A log of the decisions we debated, what we chose, and why. Each one was a real fork.

---

## D1 — This is a comprehension-memory product, not a "language learning" app
**Decision:** Target non-native-English-speaking knowledge workers (esp. developers) operating
in English at work. Frame as "stop re-learning what you meet daily," not "learn a language."
**Why:** The hobbyist "learner" identity is abandoned; the "professional in a second language"
is a daily pain with budget. The source list (GitHub/Slack/Jira/...) literally describes this
person. Reframing changes ICP, pricing, GTM, and moat.

## D2 — Obsidian is a wedge, not the foundation
**Decision:** Source of truth = our own local store. Obsidian markdown = a *projection*; Obsidian
community = a *distribution channel*. Never the source of truth.
**Why:** Obsidian is a desktop-first power-user niche, weak on mobile, and coupling our data model
to someone else's file format/sync caps TAM and kills the mobile story. But its community is a
free distribution channel to our exact ICP, and local markdown is a real privacy/trust story.
**Rejected:** Obsidian-as-database (kills mobile, vector search, portability).

## D3 — Review is required; we make it micro + contextual
**Decision:** Keep active recall, but as 5-second inline micro-reviews that replay the original
context. Do not market "zero effort / pure side effect."
**Why:** Retrieval practice is what creates durable memory (strongest result in learning science).
Pure passive capture produces a note graveyard. The innovation is *shrinking* review into the
flow, not removing it.

## D4 — The knowledge graph is an engine, not a UI feature
**Decision:** Build typed edges from embeddings + real co-occurrence; use them to drive retrieval
and review. Do not put a graph view on the front page or sell it.
**Why:** Obsidian's graph view proves graphs are mostly eye candy for end users. Value is in
better reviews, not a pretty picture.

## D5 — Capture surface ≠ brain; v1 surface = browser extension
**Decision:** One shared brain; pluggable capture surfaces. Ship the browser extension first;
architect for a later OS-wide desktop app, mobile share-sheet, IDE plugin.
**Why:** Extension gives the richest context cheaply and covers ~80% of the ICP's surfaces (all
web). Desktop app (Accessibility API / clipboard, + screenshot-OCR) patches native apps later.
**Rejected:** Extension as *the* product (only covers the browser; misses Slack/Claude desktop,
IDE, PDF).

## D6 — Local brain = SQLite, NOT MongoDB
**Decision:** Local store is SQLite (+ `sqlite-vec` for vectors, + JSON columns for flexible
fields, + Prisma for migrations). MongoDB is reserved for the *server* later (sync/aggregates).
**Why:** The local brain must be **embedded, single-user, offline**. SQLite is embedded (one
file, no server, runs offline, ships everywhere). **MongoDB is a server** — you cannot reasonably
embed it in an Obsidian plugin / desktop app for thousands of users; running `mongod` per user is
an ops nightmare, and Atlas (cloud) breaks local-first/offline/privacy. SQLite handles millions of
rows on a laptop with sub-ms reads; the user's whole graph is thousands–tens-of-thousands of rows.
**On the schema fear:** the "rigid schema / scary migrations" worry is dissolved by **JSON columns**
(Mongo-like flexibility for evolving fields) + **Prisma** (auto-generated migrations, type-safe, no
hand-written SQL). Prisma also runs on SQLite/Postgres/Mongo, so switching later isn't a rewrite.
`sqlite-vec` gives local vector search; Mongo vector search is Atlas-only (cloud).

## D7 — Server is a thin gateway; stack = Fastify + TS + Prisma + SQLite
**Decision:** Server does auth + AI gateway/routing + user/quota/billing. Server DB is SQLite.
**Why:** The brain lives on the client, so the server needs almost no data. On a 512 MB VPS we
can't run a DB server. Fastify + TS keeps one language across extension & server and is lean
(~80–120 MB) vs NestJS (heavier). Go would be most RAM-efficient but adds a learning curve for a
non-BE founder.

## D8 — Gateway holds keys; JWT authenticates the user
**Decision:** Extension always calls our gateway (never an LLM provider directly). Google OAuth →
JWT access (~15 min) + refresh token, stored in `chrome.storage.local`.
**Why:** Keys in a client leak within a day. A gateway lets us swap models, cache, and control
cost. JWT authenticates the *user*, not the *app* — that's expected; client attestation is
unnecessary complexity for MVP.

## D9 — Model routing, no local model in v1
**Decision:** Route by task (cheap model for translate+gloss; medium for tone/grammar; dedicated
curation policy; batched cheap models for async link/profile). Ship no on-device model in v1.
**Why:** One big model for everything destroys margins. A local model is heavy on user machines
and slows launch — defer it as a privacy-selling feature.

## D10 — Paragraph = Encounter (context); extracted units = Concepts
**Decision:** Store the whole paragraph as an Encounter; AI extracts worth-remembering units,
user confirms which become Concepts (each linked back to the paragraph). Never store a paragraph
as one reviewable unit; never auto-extract everything.
**Why:** Paragraphs aren't reviewable knowledge; isolated words lose context. This keeps the graph
clean and review meaningful, and reuses the paragraph as "original context" in review.

## D11 — Privacy: per-domain cloud toggle + graceful degradation
**Decision:** Send only selection + minimal surrounding context; per-domain "don't send to cloud"
toggle; never store secret-leaking identifiers; mark `low_context` when context is unavailable
and degrade gracefully.
**Why:** The ICP works in sensitive private tools (Jira). Local-first + explicit consent is a
selling point, not a constraint.

## D12 — Pricing charges for amplification, never for capturing/remembering
**Decision:** Free = unlimited local capture/storage + a daily AI-lookup cap. Pro = unlimited AI +
cloud sync + advanced review + desktop app. B2B team plans are the real prize.
**Why:** Per-request pricing punishes the most engaged user; per-storage pricing caps our own moat
(storage is ~free, on the user's disk). Limit what costs *us* money (AI calls), sell amplification.

## D13 — Infra is staging-grade for now
**Decision:** Use the 512 MB DO droplet (`165.22.109.245`) as staging: add swap, no on-box builds,
no DB server (SQLite only), Cloudflare in front; upgrade when real traffic arrives.
**Why:** 512 MB is fine to prove the loop with a few users, not for production.

---

## Open questions / risks to revisit
- **In-extension storage:** IndexedDB (simple, browser-native) vs SQLite-WASM/OPFS (closer to the
  real brain, can use vectors). Decide when building Phase 2.
- **How the browser extension reaches the SQLite+`sqlite-vec` brain:** likely a local companion /
  the Obsidian plugin exposing a localhost bridge (extensions can't open native SQLite). Resolve
  in Phase 4.
- **Curation classifier cold-start:** how good is "worth remembering?" before we have behavior
  data? Likely heuristic + LLM rubric first, learned policy later.
- **Lossless Obsidian round-trip:** the highest-risk piece of the projection layer.
