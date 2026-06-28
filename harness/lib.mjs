// Shared helpers for the self-verification harness.
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/** Run a shell command synchronously. Returns { ok, code, out }. */
export function sh(cmd, { cwd = ROOT, env = {} } = {}) {
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', env: { ...process.env, ...env } });
  return { ok: r.status === 0, code: r.status ?? 1, out: (r.stdout ?? '') + (r.stderr ?? '') };
}

/** A check is { name, ok, detail, skip? }. runStep wraps an async fn into that shape. */
export async function runStep(name, fn) {
  try {
    const detail = await fn();
    return { name, ok: true, detail: detail ?? '' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // A check may throw "SKIP: ..." to mark an environmental skip (e.g. upstream quota) that should
    // NOT be treated as a code regression.
    if (msg.startsWith('SKIP:')) return { name, ok: true, skip: true, detail: msg.slice(5).trim() };
    return { name, ok: false, detail: msg };
  }
}

/**
 * Wrap a live-AI check so a TRANSIENT upstream error (429 rate limit, 503 overload) becomes a SKIP
 * rather than a code-failure. Real errors (400/500/empty) still fail.
 */
export function skipOn429(fn) {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      const s = String(e);
      if (/\b(429|503)\b|rate limit|quota|overload|unavailable|currently experiencing/i.test(s)) {
        throw new Error('SKIP: Gemini transient upstream (429/503) — code unchanged, retry later');
      }
      throw e;
    }
  };
}

/** Assert helper for checks. */
export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/**
 * Start the built server, wait for /health, run `fn(baseUrl)`, then kill it.
 * Uses a dedicated port so it never clashes with a dev server.
 */
export async function withServer(fn, { port = 3199 } = {}) {
  const cwd = join(ROOT, 'apps/server');
  const child = spawn('node', ['--env-file=.env', 'dist/index.js'], {
    cwd,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', LOG_LEVEL: 'silent' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  const base = `http://127.0.0.1:${port}`;
  try {
    let up = false;
    for (let i = 0; i < 50; i++) {
      try {
        const r = await fetch(`${base}/health`);
        if (r.ok) {
          up = true;
          break;
        }
      } catch {
        /* not ready */
      }
      await sleep(100);
    }
    if (!up) throw new Error(`server did not become healthy\n${log.slice(0, 800)}`);
    return await fn(base);
  } finally {
    child.kill('SIGKILL');
  }
}

/** Fetch JSON with optional method/body/token; throws on non-2xx. */
export async function api(base, path, { method = 'GET', body, token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  return json;
}

/** Print a check report and return true if all passed. */
export function report(title, checks) {
  console.log(`\n${BOLD}${title}${RESET}`);
  let allOk = true;
  let skipped = 0;
  for (const c of checks) {
    const mark = c.skip ? `${DIM}⚠${RESET}` : c.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${mark} ${c.name}${c.detail ? `  ${DIM}— ${oneLine(c.detail)}${RESET}` : ''}`);
    if (c.skip) skipped++;
    if (!c.ok) allOk = false;
  }
  const summary = allOk ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  const skipNote = skipped ? `, ${skipped} skipped` : '';
  console.log(`  ${summary} (${checks.filter((c) => c.ok && !c.skip).length}/${checks.length}${skipNote})\n`);
  return allOk;
}

function oneLine(s) {
  return String(s).replace(/\s+/g, ' ').trim().slice(0, 160);
}
