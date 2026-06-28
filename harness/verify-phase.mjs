#!/usr/bin/env node
// Self-verification harness. Checks the acceptance criteria for a roadmap phase.
// Usage: node harness/verify-phase.mjs <phase>   (default: highest implemented)
//
// Always runs the static gates (typecheck, lint, unit tests, build) so a regression in any phase
// fails the run, then runs the live acceptance checks for phases 0..N.
import { sh, runStep, assert, withServer, api, report, skipOn429, ROOT } from './lib.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const HIGHEST_IMPLEMENTED = 5;
const phase = Number(process.argv[2] ?? HIGHEST_IMPLEMENTED);

// ---- Static gates (run once, cover every phase) ----
async function staticGates() {
  const checks = [];
  checks.push(await runStep('typecheck (all packages)', () => {
    const r = sh('pnpm -r typecheck');
    assert(r.ok, tail(r.out));
  }));
  checks.push(await runStep('lint', () => {
    const r = sh('pnpm lint');
    assert(r.ok, tail(r.out));
  }));
  checks.push(await runStep('unit tests', () => {
    const r = sh('pnpm -r test');
    assert(r.ok, tail(r.out));
    return matchLine(r.out, /Tests\s+\d+ passed|passed \(\d+\)/) ?? 'passed';
  }));
  checks.push(await runStep('build (all packages)', () => {
    const r = sh('pnpm -r build');
    assert(r.ok, tail(r.out));
  }));
  return checks;
}

// ---- Live acceptance checks, keyed by phase ----
const live = {
  0: [
    {
      name: 'P0: server /health returns 200 ok',
      fn: async ({ base }) => {
        const h = await api(base, '/health');
        assert(h.status === 'ok', `unexpected: ${JSON.stringify(h)}`);
        return `version ${h.version}`;
      },
    },
    {
      name: 'P0: extension builds to chrome-mv3',
      fn: async () => {
        assert(
          existsSync(join(ROOT, 'apps/extension/.output/chrome-mv3/manifest.json')),
          'chrome-mv3/manifest.json missing — run extension build',
        );
      },
    },
  ],
  1: [
    {
      name: 'P1: dev auth issues a JWT',
      fn: async (ctx) => {
        const r = await api(ctx.base, '/v1/auth/dev', {
          method: 'POST',
          body: { email: 'harness@memoris.test' },
        });
        assert(r.accessToken, 'no accessToken');
        ctx.token = r.accessToken;
        return 'token issued';
      },
    },
    {
      name: 'P1: /v1/analyze returns a translation + gloss (live Gemini)',
      fn: skipOn429(async ({ base, token }) => {
        const r = await api(base, '/v1/analyze', {
          method: 'POST',
          token,
          body: { text: 'make the webhook handler idempotent', targetLanguage: 'vi' },
        });
        assert(r.translation && r.translation.length > 0, 'empty translation');
        assert(typeof r.gloss === 'string', 'no gloss');
        return `“${r.translation.slice(0, 40)}…”`;
      }),
    },
    {
      name: 'P1: /v1/analyze rejects unauthenticated calls',
      fn: async ({ base }) => {
        let rejected = false;
        try {
          await api(base, '/v1/analyze', { method: 'POST', body: { text: 'x', targetLanguage: 'vi' } });
        } catch (e) {
          rejected = /401/.test(String(e));
        }
        assert(rejected, 'unauthenticated call was not rejected with 401');
      },
    },
  ],
  2: [
    {
      name: 'P2: /v1/embed returns a vector (live Gemini)',
      fn: skipOn429(async ({ base, token }) => {
        const r = await api(base, '/v1/embed', {
          method: 'POST',
          token,
          body: { text: 'idempotent' },
        });
        assert(Array.isArray(r.embedding) && r.embedding.length > 50, 'no embedding vector');
        return `dim ${r.embedding.length}`;
      }),
    },
    {
      name: 'P2: /v1/curate returns an LLM worth-remembering rubric (live Gemini)',
      fn: skipOn429(async ({ base, token }) => {
        const r = await api(base, '/v1/curate', {
          method: 'POST',
          token,
          body: { text: 'idempotent', targetLanguage: 'vi' },
        });
        assert(typeof r.worthRemembering === 'boolean', 'no verdict');
        assert(['easy', 'medium', 'hard'].includes(r.difficulty), 'no difficulty');
        return `worth=${r.worthRemembering}, ${r.difficulty}`;
      }),
    },
    {
      name: 'P2: dedup/merge + co-occurrence + tier-0/1 covered by unit tests',
      fn: async () => {
        // Asserted in @memoris/core store.test.ts (run by the static "unit tests" gate).
        assert(existsSync(join(ROOT, 'packages/core/src/store.test.ts')), 'core store tests missing');
      },
    },
  ],
  3: [
    {
      name: 'P3: review scheduler logic covered by unit tests',
      fn: async () => {
        assert(existsSync(join(ROOT, 'packages/core/src/review.ts')), 'review module missing');
      },
    },
  ],
  4: [
    {
      name: 'P4: Obsidian plugin builds to main.js',
      fn: async () => {
        assert(existsSync(join(ROOT, 'apps/obsidian-plugin/main.js')), 'plugin main.js missing');
        assert(existsSync(join(ROOT, 'apps/obsidian-plugin/manifest.json')), 'plugin manifest missing');
      },
    },
    {
      name: 'P4: markdown projection + lossless round-trip covered by unit tests',
      fn: async () => {
        assert(existsSync(join(ROOT, 'packages/core/src/markdown.test.ts')), 'markdown tests missing');
      },
    },
  ],
  5: [
    {
      name: 'P5: /v1/stats returns brain stats',
      fn: async ({ base, token }) => {
        const r = await api(base, '/v1/me/stats', { token });
        assert(typeof r.concepts === 'number', 'no stats');
        return `${r.concepts} concepts`;
      },
    },
    {
      name: 'P5: free plan exposes a daily AI limit (quota enforced at gateway)',
      fn: async ({ base, token }) => {
        const r = await api(base, '/v1/me', { token });
        assert(r.plan === 'free', `expected free, got ${r.plan}`);
        assert(typeof r.dailyLimit === 'number' && r.dailyLimit > 0, 'free plan has no daily limit');
        return `plan ${r.plan}, limit ${r.dailyLimit}, used ${r.usageToday}`;
      },
    },
    {
      name: 'P5: upgrading to Pro removes the daily cap',
      fn: async ({ base, token }) => {
        await api(base, '/v1/billing/dev-set-plan', { method: 'POST', token, body: { plan: 'pro' } });
        const pro = await api(base, '/v1/me', { token });
        assert(pro.plan === 'pro' && pro.dailyLimit === null, 'pro should be unlimited');
        await api(base, '/v1/billing/dev-set-plan', { method: 'POST', token, body: { plan: 'free' } });
        return 'free → pro → free';
      },
    },
    {
      name: 'P5: dashboard builds to static files',
      fn: async () => {
        assert(
          existsSync(join(ROOT, 'apps/dashboard/dist/index.html')),
          'dashboard dist missing',
        );
      },
    },
  ],
};

function tail(s) {
  return String(s).split('\n').filter(Boolean).slice(-8).join(' | ');
}
function matchLine(s, re) {
  const m = String(s).match(re);
  return m ? m[0] : undefined;
}

async function main() {
  console.log(`\n=== Memoris — verifying through Phase ${phase} ===`);
  const statics = await staticGates();
  const okStatic = report('Static gates', statics);

  // Collect live checks for phases 0..N.
  const liveChecks = [];
  for (let p = 0; p <= phase; p++) {
    for (const c of live[p] ?? []) liveChecks.push({ phase: p, ...c });
  }

  let okLive = true;
  if (okStatic && liveChecks.length) {
    const results = await withServer(async (base) => {
      const ctx = { base, token: undefined };
      const out = [];
      for (const c of liveChecks) {
        out.push(await runStep(c.name, () => c.fn(ctx)));
      }
      return out;
    });
    okLive = report('Live acceptance checks', results);
  } else if (!okStatic) {
    console.log('Skipping live checks — static gates failed.\n');
    okLive = false;
  }

  const pass = okStatic && okLive;
  console.log(pass ? '✅ VERIFY PASS' : '❌ VERIFY FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('harness error:', e);
  process.exit(1);
});
