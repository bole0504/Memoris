import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { Source } from '@memoris/shared';
import { MSG, type CaptureResult, type Reply } from '../../lib/messages.js';

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
  | { kind: 'error'; message: string }
  | { kind: 'ready'; result: CaptureResult };

export function Popover({ captureId, selection, context, source, rect, onClose }: PopoverProps) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reply = (await browser.runtime.sendMessage({
        type: MSG.capture,
        captureId,
        selection,
        context,
        source,
      })) as Reply<CaptureResult>;
      if (cancelled) return;
      if (reply.ok) setView({ kind: 'ready', result: reply.data });
      else if (reply.needAuth) setView({ kind: 'need-auth' });
      else if (reply.error !== 'cancelled') setView({ kind: 'error', message: reply.error });
    })();
    // On unmount (close / click-outside), abort the in-flight upstream request.
    return () => {
      cancelled = true;
      void browser.runtime.sendMessage({ type: MSG.cancel, captureId });
    };
  }, [captureId, selection, context, source]);

  async function onRemember(unitText: string, encounterId: string) {
    const reply = (await browser.runtime.sendMessage({
      type: MSG.remember,
      encounterId,
      unitText,
    })) as Reply<{ conceptId: string }>;
    if (reply.ok) setSaved((s) => new Set(s).add(unitText));
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(rect.bottom + 8, window.innerHeight - 40),
    left: Math.min(rect.left, window.innerWidth - 360),
    zIndex: 2147483647,
  };

  return (
    <div
      style={style}
      className="w-[340px] max-w-[92vw] rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl"
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <span className="text-sm font-semibold text-indigo-600">Memoris</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="close">
          ✕
        </button>
      </header>

      <div className="px-4 py-3 text-sm">
        {view.kind === 'loading' && <p className="text-slate-500">Translating…</p>}

        {view.kind === 'need-auth' && (
          <p className="text-slate-600">
            Sign in from the Memoris toolbar icon to start translating &amp; remembering.
          </p>
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

            {view.result.timings && (
              <p className="text-[10px] text-slate-400">
                {view.result.analysis.cached ? '⚡ cached (instant)' : `⚡ ${view.result.timings.aiMs}ms AI`} ·{' '}
                {view.result.timings.totalMs}ms total
                {view.result.timings.attempts > 1 ? ` · ${view.result.timings.attempts} tries` : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
