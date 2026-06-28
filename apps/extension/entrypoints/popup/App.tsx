import { useEffect, useState } from 'react';
import { login, getMe, type MeResponse } from '../../lib/api.js';
import { getAuth, setAuth, getSettings, setSettings, type Settings } from '../../lib/storage.js';

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

  async function refresh() {
    setLocalSettings(await getSettings());
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

  return (
    <div className="w-80 bg-white p-5 font-sans text-slate-800">
      <h1 className="text-lg font-semibold text-indigo-600">Memoris</h1>
      <p className="mt-0.5 text-xs text-slate-500">Second brain for working in a second language.</p>

      {!me ? (
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
