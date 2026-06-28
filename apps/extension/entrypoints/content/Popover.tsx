import { useEffect, useRef, useState } from 'react';
import type { Source } from '@memoris/shared';
import { analyze, embed, ApiError } from '../../lib/api.js';
import { getBrain } from '../../lib/brain.js';
import { getSettings, getAuth } from '../../lib/storage.js';
import { runCapture, rememberUnit, type CaptureDeps, type CaptureState } from '../../lib/capture-controller.js';
import { pushStats } from '../../lib/api.js';

export interface PopoverProps {
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
  | { kind: 'ready'; state: CaptureState };

export function Popover({ selection, context, source, rect, onClose }: PopoverProps) {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const savedConceptIds = useRef<string[]>([]);
  const depsRef = useRef<CaptureDeps | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await getAuth();
      if (!auth) {
        setView({ kind: 'need-auth' });
        return;
      }
      const settings = await getSettings();
      const deps: CaptureDeps = { analyze, embed, brain: getBrain(), targetLanguage: settings.targetLanguage };
      depsRef.current = deps;
      try {
        const state = await runCapture({ selection, surroundingContext: context, source }, deps);
        if (!cancelled) setView({ kind: 'ready', state });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setView({ kind: 'need-auth' });
        else setView({ kind: 'error', message: err instanceof Error ? err.message : 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selection, context, source]);

  async function onRemember(unitText: string) {
    if (view.kind !== 'ready' || !depsRef.current) return;
    const unit = view.state.analysis.proposedUnits.find((u) => u.text === unitText);
    if (!unit) return;
    const concept = await rememberUnit(view.state, unit, depsRef.current);
    setSaved((s) => new Set(s).add(unitText));

    // Units saved from the same passage co-occur in the user's real work → link them.
    savedConceptIds.current.push(concept.id);
    if (savedConceptIds.current.length >= 2) {
      await depsRef.current.brain.linkCoOccurrence(savedConceptIds.current);
    }
    // Best-effort stats push so the dashboard reflects growth.
    try {
      const stats = await depsRef.current.brain.stats();
      await pushStats({
        concepts: stats.concepts,
        encounters: stats.encounters,
        streakDays: 0,
        topConcepts: stats.topConcepts.map((c) => ({ text: c.text, encounterCount: c.encounterCount })),
      });
    } catch {
      /* offline / not signed in — fine */
    }
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
            <p className="text-base font-medium text-slate-900">{view.state.analysis.translation}</p>
            <p className="text-slate-500">{view.state.analysis.gloss}</p>

            {view.state.verdict.status !== 'new' && (
              <p className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                {view.state.verdict.message}
              </p>
            )}

            <div className="space-y-1.5">
              {view.state.analysis.proposedUnits.map((u) => (
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
                    onClick={() => onRemember(u.text)}
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
