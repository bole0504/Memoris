import { useEffect, useMemo, useState } from 'react';
import type { Encounter, StoredConcept, ReviewGrade } from '@memoris/core';
import { getBrain } from '../../lib/brain.js';

type Tab = 'words' | 'review';
type Sort = 'seen' | 'mastery' | 'recent';

export function App() {
  const [tab, setTab] = useState<Tab>('words');
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <h1 className="text-lg font-bold text-indigo-600">Memoris · Knowledge</h1>
          <nav className="flex gap-1 text-sm">
            {(['words', 'review'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 font-medium ${
                  tab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t === 'words' ? 'Words' : 'Review'}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">
        {tab === 'words' ? <Words /> : <ReviewPanel />}
      </main>
    </div>
  );
}

function Words() {
  const [concepts, setConcepts] = useState<StoredConcept[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('seen');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function reload() {
    setConcepts(await getBrain().listConcepts());
  }
  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = concepts.filter(
      (c) => !q || c.text.toLowerCase().includes(q) || (c.gloss ?? '').toLowerCase().includes(q),
    );
    const by: Record<Sort, (a: StoredConcept, b: StoredConcept) => number> = {
      seen: (a, b) => b.encounterCount - a.encounterCount,
      mastery: (a, b) => a.review.mastery - b.review.mastery,
      recent: (a, b) => b.firstSeen.localeCompare(a.firstSeen),
    };
    return [...list].sort(by[sort]);
  }, [concepts, query, sort]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.2fr]">
      <section>
        <div className="mb-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words / gloss…"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-md border border-slate-300 px-2 text-sm"
          >
            <option value="seen">Most seen</option>
            <option value="mastery">Weakest</option>
            <option value="recent">Recent</option>
          </select>
        </div>
        <p className="mb-2 text-xs text-slate-400">{filtered.length} concept(s)</p>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 ${
                  selectedId === c.id ? 'bg-indigo-50' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="font-medium text-slate-800">{c.text}</span>
                  <span className="ml-2 text-xs text-slate-400">{c.type}</span>
                  {c.gloss && <span className="block truncate text-xs text-slate-500">{c.gloss}</span>}
                </span>
                <span className="ml-2 shrink-0 text-xs text-slate-400">{c.encounterCount}×</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-slate-400">
              No saved words yet — select text on any page and tap “Remember”.
            </li>
          )}
        </ul>
      </section>

      <section>
        {selectedId ? (
          <Detail key={selectedId} conceptId={selectedId} onChanged={reload} onDeleted={() => { setSelectedId(null); void reload(); }} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
            Select a word to view its sources and edit it.
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({
  conceptId,
  onChanged,
  onDeleted,
}: {
  conceptId: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [concept, setConcept] = useState<StoredConcept | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [gloss, setGloss] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const c = await getBrain().getConcept(conceptId);
      setConcept(c ?? null);
      setGloss(c?.gloss ?? '');
      setNotes(c?.notes ?? '');
      setEncounters(await getBrain().conceptEncounters(conceptId));
    })();
  }, [conceptId]);

  if (!concept) return null;

  async function save() {
    await getBrain().updateConcept(conceptId, { gloss, notes });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChanged();
  }
  async function remove() {
    if (!confirm(`Delete “${concept?.text}”?`)) return;
    await getBrain().deleteConcept(conceptId);
    onDeleted();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{concept.text}</h2>
          <p className="text-xs text-slate-400">
            {concept.type} · seen {concept.encounterCount}× · mastery {Math.round(concept.review.mastery * 100)}%
          </p>
        </div>
        <button onClick={() => void remove()} className="text-xs text-rose-500 hover:text-rose-700">
          Delete
        </button>
      </div>

      <label className="mt-4 block text-xs font-medium text-slate-500">Gloss</label>
      <input
        value={gloss}
        onChange={(e) => setGloss(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      <label className="mt-3 block text-xs font-medium text-slate-500">Your notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Mnemonics, personal reminders…"
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />

      <button
        onClick={() => void save()}
        className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
      >
        {saved ? 'Saved ✓' : 'Save'}
      </button>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Encounters ({encounters.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {encounters
          .slice()
          .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
          .map((e) => (
            <li key={e.id} className="rounded-lg bg-slate-50 p-2.5 text-xs">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {e.capturedAt.slice(0, 10)} · {e.source.app}
              </p>
              <p className="mt-0.5 italic text-slate-600">“{e.selection}”</p>
            </li>
          ))}
      </ul>
    </div>
  );
}

const GRADES: { grade: ReviewGrade; label: string; cls: string }[] = [
  { grade: 'again', label: 'Again', cls: 'bg-rose-500' },
  { grade: 'hard', label: 'Hard', cls: 'bg-amber-500' },
  { grade: 'good', label: 'Good', cls: 'bg-indigo-600' },
  { grade: 'easy', label: 'Easy', cls: 'bg-emerald-500' },
];

function ReviewPanel() {
  const [queue, setQueue] = useState<string[] | null>(null);
  const [i, setI] = useState(0);
  const [concept, setConcept] = useState<StoredConcept | null>(null);
  const [source, setSource] = useState<Encounter | undefined>(undefined);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    void getBrain()
      .reviewQueue()
      .then((cs) => setQueue(cs.map((c) => c.id)));
  }, []);

  useEffect(() => {
    if (!queue || i >= queue.length) {
      setConcept(null);
      return;
    }
    setRevealed(false);
    void getBrain()
      .buildReviewCard(queue[i]!)
      .then((card) => {
        setConcept(card?.concept ?? null);
        setSource(card?.source);
      });
  }, [queue, i]);

  async function grade(g: ReviewGrade) {
    if (!concept) return;
    await getBrain().gradeReview(concept.id, g);
    setI((n) => n + 1);
  }

  if (!queue) return <p className="text-sm text-slate-500">Loading…</p>;
  if (i >= queue.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
        <p className="text-lg font-medium text-emerald-600">
          {queue.length ? 'Review done for now 🎉' : 'Nothing due — keep working, Memoris is watching.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6">
      <p className="mb-3 text-xs text-slate-400">
        Review {i + 1}/{queue.length}
      </p>
      {source && (
        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">From {source.source.app}</p>
          <p className="italic">“{source.selection}”</p>
        </div>
      )}
      <p className="text-2xl font-semibold text-slate-900">{concept?.text}</p>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="mt-4 w-full rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
        >
          Show meaning
        </button>
      ) : (
        <>
          <p className="mt-3 text-slate-600">{concept?.gloss ?? '(no gloss saved)'}</p>
          {concept?.notes && <p className="mt-1 text-sm text-slate-500">📝 {concept.notes}</p>}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <button
                key={g.grade}
                onClick={() => void grade(g.grade)}
                className={`rounded-md px-2 py-2 text-sm font-medium text-white ${g.cls}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
