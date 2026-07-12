# Memoris — Chrome Web Store submission

Everything you need to publish. Icons are generated (`pnpm --filter @memoris/extension icons`); the
copy below is ready to paste into the Developer Dashboard.

## Build the upload package
```bash
pnpm --filter @memoris/extension zip     # → apps/extension/.output/memoris-<version>-chrome.zip
```
Upload that zip at https://chrome.google.com/webstore/devconsole (one-time $5 developer account).

## Listing copy

**Name:** Memoris — translate & remember

**Summary (≤132 chars):**
Select any English text to translate it, then remember it. Your vocabulary becomes a connected,
personal knowledge graph.

**Category:** Productivity · **Language:** English

**Description:**
```
Memoris is a second brain for working in a second language. It's not another translator or
flashcard app — it's the memory layer that turns everyday translation into lasting knowledge.

• Select text on any page → click the Memoris icon → get a translation + a plain-English gloss.
• Tap "Remember" to save it, with the real sentence and source it came from.
• Memoris tells you "you've seen this before", links related words, and groups them by where you
  met them — a knowledge graph that grows out of your real work.
• Contextual review replays the original sentence, so review feels like your week, not a deck.
• Your saved words live on YOUR device. Mark any site as private to never send its content.

Built for non-native English speakers who work in English all day (GitHub, docs, Slack, Jira).
```

## Privacy tab (required)

- **Single purpose:** Translate text the user selects and help them remember it.
- **Privacy policy URL:** `https://api.flashcard.io.vn/privacy`
- **Data collected:** the text the user explicitly selects (sent to an AI provider to translate);
  email (for sign-in); anonymous usage counts. Not sold. Not used for unrelated purposes.
- **Not collected:** browsing history, full page content, passwords, cookies.

## Permission justifications (paste per permission)

| Permission | Justification |
|---|---|
| `activeTab` / `host_permissions: <all_urls>` | The core feature is translating text the user selects on **any** website they're reading (GitHub, docs, Jira…). We only read the user's explicit selection + minimal surrounding context, and only when they click the icon — never the whole page, never automatically. |
| `storage` | Store the user's settings, session token, and their saved vocabulary locally. |
| `unlimitedStorage` | The local vocabulary "brain" (IndexedDB) can grow; this prevents the browser from evicting the user's saved words. |
| `identity` (after OAuth) | Sign in with Google via `chrome.identity` so the user has an account for usage limits. |

> `<all_urls>` gets extra review scrutiny — the justification above (explicit selection only, on-click
> only, no page scraping) is the key point reviewers look for. The per-domain **private** toggle and
> the first-run **consent** screen back this up.

## Assets checklist
- ☑ Icons 16/32/48/128 (generated from `assets/icon.svg`).
- ☐ Screenshots: 1–5 images, **1280×800** or **640×400** (popover on a real page, the Knowledge
  graph, the review screen).
- ☐ Small promo tile 440×280 (optional).

## Before you submit
- ☑ HTTPS gateway + privacy policy live.
- ☑ First-run consent + secret-skip.
- ☐ Bump `version` in `apps/extension/package.json` for each new upload.
- ☐ (Recommended) Google OAuth enabled before wide release (see docs/SECURITY.md).
