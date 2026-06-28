import { useEffect, useState } from 'react';
import type { Encounter, StoredConcept, ReviewGrade } from '@memoris/core';
import { getBrain } from '../../lib/brain.js';

interface Card {
  concept: StoredConcept;
  source?: Encounter;
}

const GRADES: { grade: ReviewGrade; label: string; cls: string }[] = [
  { grade: 'again', label: 'Again', cls: 'bg-rose-500' },
  { grade: 'hard', label: 'Hard', cls: 'bg-amber-500' },
  { grade: 'good', label: 'Good', cls: 'bg-indigo-600' },
  { grade: 'easy', label: 'Easy', cls: 'bg-emerald-500' },
];

/** Inline micro-review: one item, recall-based, replays the original source (docs/ROADMAP §Phase 3). */
export function Review({ onExit }: { onExit: () => void }) {
  const [queue, setQueue] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [card, setCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    void getBrain()
      .reviewQueue()
      .then((cs) => setQueue(cs.map((c) => c.id)));
  }, []);

  useEffect(() => {
    if (!queue || i >= queue.length) {
      setCard(null);
      return;
    }
    setRevealed(false);
    void getBrain()
      .buildReviewCard(queue[i]!)
      .then((c) => setCard(c ?? null));
  }, [queue, i]);

  async function grade(g: ReviewGrade) {
    if (!card) return;
    await getBrain().gradeReview(card.concept.id, g);
    setI((n) => n + 1);
  }

  if (!queue) return <p className="text-sm text-slate-500">Loading review…</p>;

  if (i >= queue.length) {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium text-emerald-600">
          {queue.length ? 'Review done for now 🎉' : 'Nothing due — go work, Memoris is watching.'}
        </p>
        <button onClick={onExit} className="text-xs text-slate-400 underline hover:text-slate-600">
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Review {i + 1}/{queue.length}
        </span>
        <button onClick={onExit} className="text-xs text-slate-400 underline hover:text-slate-600">
          exit
        </button>
      </div>

      {card && (
        <>
          {card.source && (
            <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
                From {card.source.source.app}
              </p>
              <p className="italic">“{card.source.selection}”</p>
            </div>
          )}
          <p className="text-base font-semibold text-slate-900">{card.concept.text}</p>

          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Show meaning
            </button>
          ) : (
            <>
              <p className="text-slate-600">{card.concept.gloss ?? '(no gloss saved)'}</p>
              <div className="grid grid-cols-4 gap-1">
                {GRADES.map((g) => (
                  <button
                    key={g.grade}
                    onClick={() => void grade(g.grade)}
                    className={`rounded-md px-1 py-1.5 text-xs font-medium text-white ${g.cls}`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
