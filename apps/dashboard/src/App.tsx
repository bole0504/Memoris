import { useEffect, useState } from 'react';
import { getMe, getStats, login, setPlan, setToken, getToken, type Me, type Stats } from './api.js';

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [m, s] = await Promise.all([getMe(), getStats()]);
      setMe(m);
      setStats(s);
    } catch {
      setMe(null);
      setToken(null);
    }
  }

  useEffect(() => {
    if (getToken()) void load();
  }, []);

  async function onSignIn() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function togglePlan() {
    if (!me) return;
    await setPlan(me.plan === 'pro' ? 'free' : 'pro');
    await load();
  }

  if (!me) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 font-sans text-slate-800">
        <h1 className="text-3xl font-bold text-indigo-600">Memoris</h1>
        <p className="mt-2 text-slate-500">Sign in to watch your memory grow.</p>
        <div className="mt-6 space-y-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@work.com"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <button
            disabled={busy || !email.includes('@')}
            onClick={onSignIn}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </main>
    );
  }

  const usagePct =
    me.dailyLimit != null ? Math.min(100, Math.round((me.usageToday / me.dailyLimit) * 100)) : 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-sans text-slate-800">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-indigo-600">Memoris</h1>
          <p className="text-sm text-slate-500">{me.email}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium capitalize">{me.plan}</span>
          <button onClick={togglePlan} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
            {me.plan === 'pro' ? 'Downgrade' : 'Upgrade to Pro'}
          </button>
          <button
            onClick={() => {
              setToken(null);
              setMe(null);
            }}
            className="text-slate-400 underline hover:text-slate-600"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Concepts" value={stats?.concepts ?? 0} />
        <Stat label="Encounters" value={stats?.encounters ?? 0} />
        <Stat label="Day streak" value={stats?.streakDays ?? 0} />
        <Stat
          label="AI today"
          value={me.dailyLimit != null ? `${me.usageToday}/${me.dailyLimit}` : `${me.usageToday}`}
        />
      </section>

      {me.dailyLimit != null && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-indigo-500" style={{ width: `${usagePct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-400">{usagePct}% of today's free AI lookups used</p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Most-encountered (your “translated N×” list)
        </h2>
        {stats && stats.topConcepts.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {stats.topConcepts.map((c) => (
              <li key={c.text} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium text-slate-800">{c.text}</span>
                <span className="text-sm text-slate-500">{c.encounterCount}×</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Nothing yet. Install the extension, select text at work, and tap “Remember”. Your memory
            shows up here.
          </p>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
