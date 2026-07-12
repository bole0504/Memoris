import { useEffect, useState } from 'react';
import { ext } from '../../lib/ext.js';
import type { Source } from '@memoris/shared';
import { MSG, type CaptureResult, type Reply } from '../../lib/messages.js';
import { getConsentAt } from '../../lib/storage.js';
import { looksLikeSecret } from '../../lib/secret.js';

export interface PopoverProps {
  captureId: string;
  selection: string;
  context?: string;
  source: Source;
  rect: { top: number; left: number; bottom: number };
  onClose: () => void;
}

type View =
  | { kind: 'loading' }
  | { kind: 'need-auth' }
  | { kind: 'need-consent' }
  | { kind: 'blocked' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; result: CaptureResult };

export function Popover({ captureId, selection, context, source, rect, onClose }: PopoverProps) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [override, setOverride] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Privacy gates before anything leaves the page.
      if (!(await getConsentAt())) {
        if (!cancelled) setView({ kind: 'need-consent' });
        return;
      }
      if (!override && looksLikeSecret(selection)) {
        if (!cancelled) setView({ kind: 'blocked' });
        return;
      }
      if (!cancelled) setView({ kind: 'loading' });
      const reply = (await ext.runtime.sendMessage({
        type: MSG.capture,
        captureId,
        selection,
        context,
        source,
      })) as Reply<CaptureResult>;
      if (cancelled) return;
      if (reply.ok) {
        if (reply.data.timings) console.debug('[Memoris] timings', reply.data.timings);
        setView({ kind: 'ready', result: reply.data });
      } else if (reply.needAuth) {
        setView({ kind: 'need-auth' });
      } else if (reply.error !== 'cancelled') {
        // Exact error → console for debugging; user sees a calm generic message.
        console.error('[Memoris] capture failed:', reply.error);
        setView({ kind: 'error', message: 'Server is busy — please try again.' });
      }
    })();
    // On unmount (close / click-outside), abort the in-flight upstream request.
    return () => {
      cancelled = true;
      void ext.runtime.sendMessage({ type: MSG.cancel, captureId });
    };
  }, [captureId, selection, context, source, override]);

  async function onRemember(unitText: string, encounterId: string) {
    const reply = (await ext.runtime.sendMessage({
      type: MSG.remember,
      encounterId,
      unitText,
    })) as Reply<{ conceptId: string }>;
    if (reply.ok) setSaved((s) => new Set(s).add(unitText));
  }

  // Place below the selection, or above it if there isn't room; cap height and let the body scroll.
  const spaceBelow = window.innerHeight - rect.bottom;
  const above = spaceBelow < 280 && rect.top > spaceBelow;
  const maxHeight = Math.max(160, (above ? rect.top : spaceBelow) - 16);
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(rect.left, window.innerWidth - 356),
    maxHeight,
    zIndex: 2147483647,
    ...(above ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
  };

  return (
    <div
      style={style}
      className="flex w-[340px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-2">
        <span className="text-sm font-semibold text-indigo-600">Memoris</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="close">
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm">
        {view.kind === 'loading' && <p className="text-slate-500">Translating…</p>}

        {view.kind === 'need-auth' && (
          <p className="text-slate-600">
            Sign in from the Memoris toolbar icon to start translating &amp; remembering.
          </p>
        )}

        {view.kind === 'need-consent' && (
          <p className="text-slate-600">
            Open the Memoris toolbar icon and agree to the privacy notice to start translating.
          </p>
        )}

        {view.kind === 'blocked' && (
          <div className="space-y-2">
            <p className="text-amber-700">
              This looks like sensitive data (a key, token, password, or card number). Memoris did
              <b> not</b> send it.
            </p>
            <button
              onClick={() => setOverride(true)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Translate anyway
            </button>
          </div>
        )}

        {view.kind === 'error' && <p className="text-rose-600">{view.message}</p>}

        {view.kind === 'ready' && (
          <div className="space-y-3">
            <p className="text-base font-medium text-slate-900">{view.result.analysis.translation}</p>
            <p className="text-slate-500">{view.result.analysis.gloss}</p>

            {view.result.verdict.status !== 'new' && (
              <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                {view.result.verdict.message}
              </p>
            )}

            <div className="space-y-1.5">
              {view.result.analysis.proposedUnits.map((u) => (
                <div
                  key={u.text}
                  className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">
                      {u.text} <span className="text-[10px] text-slate-400">{u.type}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">{u.gloss}</p>
                  </div>
                  <button
                    disabled={saved.has(u.text)}
                    onClick={() => void onRemember(u.text, view.result.encounterId)}
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
    </div>
  );
}
