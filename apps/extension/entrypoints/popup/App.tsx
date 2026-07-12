import { useEffect, useState } from 'react';
import {
  getSettings,
  setSettings,
  getConsentAt,
  setConsent,
  type Settings,
} from '../../lib/storage.js';
import { PRIVACY_URL } from '../../lib/config.js';
import { getBrain } from '../../lib/brain.js';
import { ext } from '../../lib/ext.js';
import { Review } from './Review.js';
import { TranslatePanel } from './TranslatePanel.js';

const LANGS = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'zh', label: '中文' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
];

export function App() {
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  const [consented, setConsented] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'home' | 'review'>('home');
  const [dueCount, setDueCount] = useState(0);

  async function refresh() {
    setConsented(!!(await getConsentAt()));
    setLocalSettings(await getSettings());
    try {
      setDueCount((await getBrain().dueReviews()).length);
    } catch {
      /* no brain yet */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

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

  // First-run privacy consent (required before anything is sent to the cloud).
  if (consented === false) {
    return (
      <div className="w-80 bg-white p-5 font-sans text-slate-800">
        <h1 className="text-lg font-semibold text-indigo-600">Memoris</h1>
        <p className="mt-2 text-sm text-slate-600">
          Memoris translates the text you select (or paste) and helps you remember it. That text is
          sent to our server and an AI provider to translate it. Your saved words stay on your
          device.
        </p>
        <a
          href={PRIVACY_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-indigo-600 underline"
        >
          Read the privacy policy
        </a>
        <button
          onClick={async () => {
            await setConsent();
            setConsented(true);
          }}
          className="mt-4 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          I understand &amp; agree
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white p-5 font-sans text-slate-800">
      <h1 className="text-lg font-semibold text-indigo-600">Memoris</h1>
      <p className="mt-0.5 text-xs text-slate-500">Second brain for working in a second language.</p>

      {mode === 'review' ? (
        <div className="mt-4">
          <Review
            onExit={() => {
              setMode('home');
              void refresh();
            }}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <TranslatePanel />

          <div className="flex gap-2">
            <button
              onClick={() => setMode('review')}
              className="flex-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {dueCount > 0 ? `Review (${dueCount})` : 'Review'}
            </button>
            <button
              onClick={() => window.open(ext.runtime.getURL('manage.html'), '_blank')}
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              My Knowledge
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">Translate into</label>
            <select
              value={settings?.targetLanguage ?? 'vi'}
              onChange={async (e) => setLocalSettings(await setSettings({ targetLanguage: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => void exportBrain()}
            className="text-xs text-slate-400 underline hover:text-slate-600"
          >
            Export my words (backup)
          </button>
        </div>
      )}
    </div>
  );
}
