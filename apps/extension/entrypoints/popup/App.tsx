import { useEffect, useState } from 'react';
import { login, getMe, type MeResponse } from '../../lib/api.js';
import { getAuth, setAuth, getSettings, setSettings, type Settings } from '../../lib/storage.js';
import { getBrain } from '../../lib/brain.js';
import { syncToObsidian } from '../../lib/obsidian.js';
import { Review } from './Review.js';

const LANGS = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh', label: '中文' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
];

export function App() {
  const [email, setEmail] = useState('');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'home' | 'review'>('home');
  const [dueCount, setDueCount] = useState(0);

  async function refresh() {
    setLocalSettings(await getSettings());
    try {
      setDueCount((await getBrain().dueReviews()).length);
    } catch {
      /* no brain yet */
    }
    if (await getAuth()) {
      try {
        setMe(await getMe());
      } catch {
        setMe(null);
      }
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSignIn() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    await setAuth(undefined);
    setMe(null);
  }

  async function onLang(code: string) {
    setLocalSettings(await setSettings({ targetLanguage: code }));
  }

  const [domain, setDomain] = useState('');
  async function addPrivateDomain() {
    const d = domain.trim().toLowerCase();
    if (!d) return;
    const current = settings?.privateDomains ?? [];
    if (!current.includes(d)) setLocalSettings(await setSettings({ privateDomains: [...current, d] }));
    setDomain('');
  }
  async function removePrivateDomain(d: string) {
    const current = settings?.privateDomains ?? [];
    setLocalSettings(await setSettings({ privateDomains: current.filter((x) => x !== d) }));
  }

  const [obsMsg, setObsMsg] = useState<string | null>(null);
  async function exportBrain() {
    const data = await getBrain().export();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'memoris-brain.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function syncObsidianNow() {
    setObsMsg('Syncing…');
    try {
      const ok = await syncToObsidian(getBrain());
      setObsMsg(ok ? 'Synced to Obsidian ✓' : 'Obsidian sync is off');
    } catch {
      setObsMsg('Obsidian isn’t open yet — sync will resume when it is.');
    }
  }
  async function toggleObsidian(v: boolean) {
    setLocalSettings(await setSettings({ obsidianSync: v }));
  }

  return (
    <div className="w-80 bg-white p-5 font-sans text-slate-800">
      <h1 className="text-lg font-semibold text-indigo-600">Memoris</h1>
      <p className="mt-0.5 text-xs text-slate-500">Second brain for working in a second language.</p>

      {mode === 'review' && me ? (
        <div className="mt-4">
          <Review
            onExit={() => {
              setMode('home');
              void refresh();
            }}
          />
        </div>
      ) : !me ? (
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium text-slate-600">Sign in (dev)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@work.com"
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <button
            disabled={busy || !email.includes('@')}
            onClick={onSignIn}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <p className="font-medium text-slate-700">{me.email}</p>
            <p className="mt-0.5 text-slate-500">
              Plan: {me.plan} · AI today: {me.usageToday}
              {me.dailyLimit != null ? ` / ${me.dailyLimit}` : ' (unlimited)'}
            </p>
          </div>

          <button
            onClick={() => setMode('review')}
            className="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            {dueCount > 0 ? `Review now (${dueCount} due)` : 'Review'}
          </button>

          <div>
            <label className="block text-xs font-medium text-slate-600">Translate into</label>
            <select
              value={settings?.targetLanguage ?? 'vi'}
              onChange={(e) => void onLang(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">
              Private domains (never sent to cloud)
            </label>
            <div className="mt-1 flex gap-1">
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="jira.company.com"
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <button
                onClick={() => void addPrivateDomain()}
                className="rounded-md bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600"
              >
                Add
              </button>
            </div>
            {!!settings?.privateDomains.length && (
              <ul className="mt-1.5 space-y-1">
                {settings.privateDomains.map((d) => (
                  <li key={d} className="flex items-center justify-between text-xs text-slate-600">
                    <span className="truncate">{d}</span>
                    <button
                      onClick={() => void removePrivateDomain(d)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Obsidian graph sync</label>
              <input
                type="checkbox"
                checked={settings?.obsidianSync ?? true}
                onChange={(e) => void toggleObsidian(e.target.checked)}
              />
            </div>
            <div className="mt-2 flex gap-1">
              <button
                onClick={() => void syncObsidianNow()}
                className="flex-1 rounded-md bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600"
              >
                Sync now
              </button>
              <button
                onClick={() => void exportBrain()}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Export JSON
              </button>
            </div>
            {obsMsg && <p className="mt-1 text-[11px] text-slate-500">{obsMsg}</p>}
          </div>

          <p className="text-xs text-slate-500">
            Select text on any page to translate &amp; remember it.
          </p>
          <button onClick={onSignOut} className="text-xs text-slate-400 underline hover:text-slate-600">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
