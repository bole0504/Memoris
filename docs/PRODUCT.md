# Memoris — Product

## 1. Problem

**Translation tools have no memory.**
Google Translate, DeepL, ChatGPT, browser translate — all solve translation well. But every
day people re-translate the same concepts, terms, idioms, and sentences. The translation
disappears after reading. Learning never happens. Knowledge never accumulates.

**Learning apps have the opposite problem.**
Duolingo, Anki, etc. ask you to *stop working and go learn*. That is a brand-new habit, and
most people abandon new habits.

Both fail the same person: someone who is already exposed to a second language every day but
gets nothing durable out of that exposure.

## 2. Vision

Language learning should happen **automatically while people are already working**. Instead
of creating new learning sessions, Memoris **captures real language exposure during daily
work**. Translation is only the input. **Learning is the side effect.**

The goal is a **"Second Brain for Language"** — not another translator, not another chatbot,
not another flashcard app.

> **Reframe (the most important strategic decision):** This is **not** a "language-learning"
> product. It is a **comprehension-memory product for second-language knowledge workers**.
> The hobbyist "language learner" identity is one people abandon; the "professional operating
> in a second language" is a daily pain with money attached.

## 3. ICP (Ideal Customer Profile)

The source list (GitHub, Slack, Confluence, Jira, StackOverflow, technical docs) points to one
person: a **non-native-English-speaking professional, disproportionately a software engineer**,
who already works in English all day. Examples: a Vietnamese backend dev at a US company; a
Brazilian PM reading Confluence; a Chinese researcher reviewing PRs.

They do not want to "learn English." They want to **stop losing time and confidence**
re-decoding the same jargon, idioms, and tone every day.

**Beachhead:** non-native software engineers who already use Obsidian (perfect overlap of pain
+ tooling love). Start with a few native languages (e.g. VI, ZH, PT-BR) → English.

## 4. Honest truths we will not pretend away

1. **Passive capture alone does NOT create memory.** Retrieval practice does (most replicated
   finding in learning science). So review is **non-negotiable**. Our innovation is not
   *eliminating* review — it is **collapsing it into 5-second contextual micro-moments** inside
   the workflow, in the context where the knowledge will actually be used. Do not oversell
   "pure side effect."
2. **Obsidian is a great wedge but a fatal foundation.** It is a power-user niche, desktop-first,
   painful on mobile. Use it as a **distribution channel** + a **markdown projection**, never as
   the **source of truth**.
3. **The graph is an engine, not a feature.** Obsidian's graph view is beautiful and almost
   nobody gets value staring at it. Don't sell the graph; *use* it to power better retrieval and
   review.
4. **The moat is not the model.** Anyone rents the same LLMs. The moat is accumulated personal
   context + curation quality + emotional switching cost.

## 5. User journey

- **Day 0 — Aha in 60s:** Install extension → select a confusing sentence in a real PR → get
  translation + tone + "why this wording" → one tap "Remember this." It is saved *with its
  source context*. The aha: *"it kept it, in context, attached to where I saw it."*
- **Week 1 — Compounding signal:** *"You've looked up `idempotent` 3 times this week."* First
  contextual micro-review fires: *"From your Stripe docs tab yesterday — what does `idempotent`
  mean here?"* 5 seconds, inline.
- **Month 1 — It knows you:** It has inferred you're a backend engineer, that you confuse
  `affect/effect` and hedging tone, that K8s vocabulary dominates your week. Review feels like
  *your* week replayed.
- **Month 3 — Identity shift:** *"You encountered this concept 3 months ago in a design review."*
  The user trusts Memoris as their language memory. **Switching cost = losing your accumulated
  self.** This is the retention moat.

## 6. Learning philosophy

- No predefined lessons. No vocabulary lists. No A1/B2 curriculum.
- Learning comes entirely from the user's own life. **The user's work is the textbook; the
  browser is the classroom.**
- Memory is **contextual, not lexical** — keyed to the idea-in-situation (embedding + encounter
  context), surfaced across different surface words.

## 7. Review system

- **Inline contextual micro-reviews:** one item, ~5 seconds, recall (not recognition), embedded
  in flow.
- **Context recreation > flashcard:** always replay the original sentence/source —
  *"Today's review is from your real GitHub PR."*
- **Real-world exposure decays the review need:** if the world keeps teaching you a word, the
  app shuts up about it. This is the anti-flashcard innovation.

## 8. Why users cannot just use ChatGPT

ChatGPT is a goldfish with no hands. It structurally lacks:
- **Persistent personal memory** of your encounters and confusions.
- **Zero-friction point-of-need capture** (you must copy-paste, breaking flow).
- **Proactive resurfacing** in context.
- **Curation** — it answers, it doesn't decide what's worth keeping, nor dedup it.
- **Local-first ownership** of your knowledge.

We are not competing with ChatGPT's *answer*. We are the **memory and curation layer it cannot
be.** (We can even use ChatGPT/Claude as our analysis engine — the model is a commodity input;
the accumulated user graph is the asset.)

## 9. Business model

Both naive models break the core principle (they make users capture/remember *less*):
- **Per-request/day** punishes your *best* user (the heavy translator = the most engaged).
- **Per-storage cap** (e.g. 1000 words then pay) caps your **own moat**, and storage costs you
  ~nothing because it lives in SQLite on the user's disk. Bad psychology: "pay to remember more
  of my own life?"

**The model we recommend — charge for amplification, not for capturing/remembering:**

| | Free | Pro (~$8–12/mo) |
|---|---|---|
| Capture & store locally | **Unlimited** (their disk) | Unlimited |
| AI lookups | Daily cap (enough for habit, ~20–30/day) | **Unlimited** |
| Cloud sync / multi-device | ❌ | ✅ |
| Advanced contextual review, quizzes | Basic | ✅ Full |
| Desktop app | ❌ | ✅ |

- **Limit what costs *you* money** (AI calls) on free — not storage.
- **Sell amplification** (cloud sync, unlimited AI, smart review, desktop app).
- **The real prize is B2B:** companies with distributed non-native teams pay per seat to onboard
  people into the company's English + internal jargon faster ("ESL-at-work" / non-native engineer
  ramp). Land bottom-up via the dev ICP, expand to team plans. B2B also unlocks a shared
  company-jargon layer → data network effects.

## 10. Go-to-market

- **Beachhead:** non-native software engineers who already use Obsidian.
- **Channels:** Obsidian community plugins (free distribution + discovery — NOT a paid
  marketplace; we sell the cloud/AI subscription, the plugin is the front door), dev communities,
  GitHub, HN, dev-influencer demos in VN/BR/IN/CN.
- **Wedge content:** *"I stopped pasting into ChatGPT 50× a day."* Show the **memory**, not the
  translation.
- **Expansion:** engineer → their non-native teammates → team plan → ESL-at-work enterprise
  motion → widen target languages and professions only after the dev beachhead is won.

## 11. The two things that decide $1B vs. nice plugin

1. **Curation quality** — "Should this become knowledge?" done well *is* the product. Done badly,
   it's noise. Spend the hardest engineering here, not on graph visualization.
2. **Accepting that review is required** — nail *micro-recall in real context* and you've built
   something Duolingo and ChatGPT both structurally cannot.
