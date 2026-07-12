import { useRef, useState } from 'react';
import { ext } from '../../lib/ext.js';
import { uuid } from '../../lib/uuid.js';
import { looksLikeSecret } from '../../lib/secret.js';
import { MSG, type CaptureResult, type Reply } from '../../lib/messages.js';

type View =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'blocked' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; result: CaptureResult };

/**
 * Paste-to-translate: works exactly like selecting text + clicking the icon, but for text you can't
 * select on a page (chat apps, PDFs, etc.). Sends through the same background CAPTURE flow.
 */
export function TranslatePanel() {
  const [text, setText] = useState('');
  const [view, setView] = useState<View>({ kind: 'idle' });
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const capId = useRef('');

  async function translate(force = false) {
    const t = text.trim();
    if (t.length < 2) return;
    if (!force && looksLikeSecret(t)) {
      setView({ kind: 'blocked' });
      return;
    }
    setSaved(new Set());
    setView({ kind: 'loading' });
    capId.current = uuid();
    const reply = (await ext.runtime.sendMessage({
      type: MSG.capture,
      captureId: capId.current,
      selection: t,
      source: { id: uuid(), app: 'Pasted', domain: 'manual' },
    })) as Reply<CaptureResult>;
    if (reply.ok) setView({ kind: 'ready', result: reply.data });
    else if (reply.error !== 'cancelled') {
      console.error('[Memoris] translate failed:', reply.error);
      setView({ kind: 'error', message: 'Server is busy — please try again.' });
    }
  }

  async function remember(unitText: string) {
    if (view.kind !== 'ready') return;
    const reply = (await ext.runtime.sendMessage({
      type: MSG.remember,
      encounterId: view.result.encounterId,
      unitText,
    })) as Reply<{ conceptId: string }>;
    if (reply.ok) setSaved((s) => new Set(s).add(unitText));
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Paste text to translate (from Slack, PDF, anywhere)…"
        className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
      />
      <button
        disabled={text.trim().length < 2 || view.kind === 'loading'}
        onClick={() => void translate()}
        className="mt-1 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {view.kind === 'loading' ? 'Translating…' : 'Translate'}
      </button>

      {view.kind === 'blocked' && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-amber-700">
            This looks like sensitive data — not sent. Translate anyway?
          </p>
          <button
            onClick={() => void translate(true)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Translate anyway
          </button>
        </div>
      )}

      {view.kind === 'error' && <p className="mt-2 text-xs text-rose-600">{view.message}</p>}

      {view.kind === 'ready' && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-medium text-slate-900">{view.result.analysis.translation}</p>
          <p className="text-xs text-slate-500">{view.result.analysis.gloss}</p>
          {view.result.verdict.status !== 'new' && (
            <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
              {view.result.verdict.message}
            </p>
          )}
          <div className="space-y-1">
            {view.result.analysis.proposedUnits.map((u) => (
              <div key={u.text} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="min-w-0">
                  <span className="truncate font-medium text-slate-800">{u.text}</span>
                  <span className="block truncate text-xs text-slate-500">{u.gloss}</span>
                </span>
                <button
                  disabled={saved.has(u.text)}
                  onClick={() => void remember(u.text)}
                  className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:bg-emerald-500"
                >
                  {saved.has(u.text) ? 'Saved ✓' : 'Remember'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
