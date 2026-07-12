import type { FastifyInstance } from 'fastify';

const UPDATED = '2026-07-11';
const CONTACT = 'duclt47@gmail.com';

/**
 * Public privacy policy page (no auth) — the URL required by the Chrome Web Store listing.
 * Served at GET /privacy. Keep it accurate to what the system actually does.
 */
const HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Memoris — Privacy Policy</title>
<style>
  body{max-width:760px;margin:40px auto;padding:0 20px;font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b}
  h1{color:#4f46e5} h2{margin-top:2em;font-size:1.15em}
  table{border-collapse:collapse;width:100%;font-size:.9em} td,th{border:1px solid #e2e8f0;padding:8px;text-align:left}
  code{background:#f1f5f9;padding:1px 5px;border-radius:4px} .muted{color:#64748b;font-size:.9em}
</style></head><body>
<h1>Memoris — Privacy Policy</h1>
<p class="muted">Last updated: ${UPDATED}</p>
<p>Memoris helps you translate and remember words you meet while working in a second language.
This policy explains exactly what leaves your device, what does not, and your choices.</p>

<h2>The short version</h2>
<ul>
  <li>Memoris only acts when <b>you select text and click the Memoris icon</b>. Nothing is sent automatically or by scanning the page.</li>
  <li>Only the <b>text you selected plus a small amount of surrounding context (≤ ~280 characters)</b> is sent to our server, which forwards it to an AI provider to translate it. <b>We never send the whole page.</b></li>
  <li>Your saved vocabulary is stored <b>locally in your browser</b>. We do not upload it. Our server only receives anonymous counts (how many words you saved).</li>
  <li>You can mark any website as <b>private</b> — on those sites Memoris never sends anything to the cloud.</li>
  <li>We do <b>not</b> read your browsing history, cookies, passwords, or other page content.</li>
</ul>

<h2>What we collect and why</h2>
<table>
<tr><th>Data</th><th>When</th><th>Why</th><th>Where it goes</th></tr>
<tr><td>Selected text + short surrounding context</td><td>When you click the Memoris icon on a selection</td><td>To translate &amp; explain it</td><td>Our gateway → AI provider (OpenRouter; may route to OpenAI/Google/Anthropic models). Google Gemini is also used for text embeddings.</td></tr>
<tr><td>Your email</td><td>When you sign in</td><td>Create your account &amp; apply usage limits</td><td>Our server (stored)</td></tr>
<tr><td>Usage counts (AI lookups/day)</td><td>On each AI request</td><td>Free-plan quota</td><td>Our server (stored)</td></tr>
<tr><td>Aggregate stats (counts only, no content)</td><td>When you save a word</td><td>Show your dashboard</td><td>Our server (stored)</td></tr>
</table>
<p>We do <b>not</b> collect browsing history, full page content, keystrokes, passwords, cookies, or the content of sites you marked private.</p>

<h2>Third-party AI providers</h2>
<p>Translations are produced by an AI provider we route to via our gateway (primarily <b>OpenRouter</b>, which may use models from OpenAI, Google, Anthropic and others; <b>Google Gemini</b> is used for embeddings). The selected text is sent to the provider to generate the result. We configure providers for no prompt logging / no training on your data where available. We do not sell your data.</p>

<h2>Retention</h2>
<ul>
  <li><b>Selected text:</b> not stored persistently by us. It transits our server and may sit in an in-memory cache for a few hours to speed up repeated identical lookups, then is discarded.</li>
  <li><b>Account, usage, stats:</b> kept while your account exists; deleted on account deletion.</li>
  <li><b>Your vocabulary:</b> stored on your own device; you can export or delete it any time.</li>
</ul>

<h2>Your choices &amp; controls</h2>
<ul>
  <li><b>Private domains:</b> add any site (e.g. <code>jira.company.com</code>) to never send its content to the cloud.</li>
  <li><b>Export / delete:</b> export your whole brain as JSON, or delete individual saved words, from the Memoris "Knowledge" page. Uninstalling removes local data.</li>
  <li>Because Memoris only acts on your explicit selection + click, you stay in control of what is ever sent.</li>
</ul>

<h2>Security</h2>
<p>Traffic between the extension and our server is encrypted with HTTPS/TLS. AI provider keys are held only on our server, never in the extension.</p>

<h2>Children</h2>
<p>Memoris is not directed at children under 13 and we do not knowingly collect their data.</p>

<h2>Changes</h2>
<p>We will update this page and the "Last updated" date when this policy changes.</p>

<h2>Contact</h2>
<p>Questions or data requests: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
</body></html>`;

export async function privacyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/privacy', async (_req, reply) => {
    return reply.header('content-type', 'text/html; charset=utf-8').send(HTML);
  });
}
