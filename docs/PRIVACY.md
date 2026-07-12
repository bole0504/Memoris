# Memoris — Privacy Policy

_Last updated: 2026-07-11. Draft — fill in the bracketed fields before publishing._

Memoris helps you translate and remember words you meet while working in a second language. This
policy explains exactly what leaves your device, what does not, and your choices.

## The short version

- Memoris only acts when **you select text and click the Memoris icon**. Nothing is sent
  automatically, in the background, or by scanning the page.
- When you use it, **only the text you selected plus a small amount of surrounding context
  (≤ ~280 characters)** is sent to our server, which forwards it to an AI provider to produce the
  translation. **We never send the whole page.**
- Your saved vocabulary (your "brain") is stored **locally in your browser**. We do **not** upload
  it. Our server only receives anonymous counts (how many words you've saved) to show your stats.
- You can mark any website as **private** — on those sites Memoris never sends anything to the cloud.
- We do **not** read your browsing history, cookies, passwords, or other page content.

## What we collect and why

| Data | When | Why | Where it goes |
|---|---|---|---|
| Selected text + short surrounding context | When you click the Memoris icon on a selection | To translate & explain it | Our gateway → AI provider ([OpenRouter]/[Google Gemini]) |
| Your email | When you sign in | To create your account & apply usage limits | Our server (stored) |
| Usage counts (AI lookups/day) | On each AI request | Free-plan quota | Our server (stored) |
| Aggregate stats (number of concepts/encounters, streak, top words — **counts only, no content**) | When you save a word | To show your dashboard | Our server (stored) |

We do **not** collect: browsing history, full page content, keystrokes, passwords, cookies, or the
content of sites you marked private.

## Third parties (AI providers)

Translations are produced by an AI provider we route to via our gateway
(**[OpenRouter]**, which may use models from OpenAI, Google, Anthropic, etc.). The selected text is
sent to that provider to generate the result. We configure providers for **no prompt logging / no
training on your data** where available; see the provider's own policy. We do not sell your data.

## Retention

- **Selected text:** not stored persistently by us. It transits our server and may sit in an
  in-memory cache for up to a few hours to speed up repeated identical lookups, then is discarded.
- **Account + usage + stats:** kept while your account exists; deleted on account deletion.
- **Your vocabulary:** stored on your own device; you can export or delete it any time.

## Your choices & controls

- **Private domains:** add any site (e.g. `jira.company.com`) to never send its content to the cloud.
- **Export / delete:** export your whole brain as JSON, or delete individual saved words, from the
  Memoris "Knowledge" page. Uninstalling removes local data.
- **Don't select sensitive text:** since Memoris only acts on your explicit selection + click, you
  stay in control of what is ever sent.

## Data security

Traffic between the extension and our server is encrypted with HTTPS/TLS. AI provider keys are held
only on our server, never in the extension.

## Children

Memoris is not directed at children under 13 and we do not knowingly collect their data.

## Changes

We will update this page and the "Last updated" date when this policy changes.

## Contact

Questions or data requests: **duclt47@gmail.com**.
