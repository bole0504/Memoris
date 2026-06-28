import { useEffect, useState } from 'react';
import type { HealthResponse } from '@memoris/shared';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

/**
 * Phase 0 dashboard — a skeleton that proves the static SPA builds and can reach the gateway.
 * Phase 5 turns this into the real "watch your memory grow" surface (concepts, streaks, billing).
 */
export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: 'loading' });

  useEffect(() => {
    fetch('/health')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<HealthResponse>;
      })
      .then((data) => setHealth({ kind: 'ok', data }))
      .catch((e: unknown) =>
        setHealth({ kind: 'error', message: e instanceof Error ? e.message : 'unknown error' }),
      );
  }, []);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 font-sans text-slate-800">
      <h1 className="text-3xl font-bold text-indigo-600">Memoris</h1>
      <p className="mt-2 text-slate-500">Your second brain for working in a second language.</p>

      <section className="mt-8 rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Gateway health
        </h2>
        {health.kind === 'loading' && <p className="mt-2 text-slate-500">Checking…</p>}
        {health.kind === 'error' && (
          <p className="mt-2 text-rose-600">
            Could not reach the gateway: {health.message}. Is the server running on :3000?
          </p>
        )}
        {health.kind === 'ok' && (
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-400">status</dt>
            <dd className="font-medium text-emerald-600">{health.data.status}</dd>
            <dt className="text-slate-400">version</dt>
            <dd>{health.data.version}</dd>
            <dt className="text-slate-400">uptime</dt>
            <dd>{health.data.uptime}s</dd>
          </dl>
        )}
      </section>
    </main>
  );
}
