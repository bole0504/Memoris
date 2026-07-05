import { useEffect, useMemo, useState } from 'react';
import { cosineSimilarity, type Encounter, type StoredConcept, type ReviewGrade } from '@memoris/core';
import { getBrain } from '../../lib/brain.js';

type Tab = 'words' | 'graph' | 'review';
type Sort = 'seen' | 'mastery' | 'recent';

export function App() {
  const [tab, setTab] = useState<Tab>('words');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function openConcept(id: string) {
    setSelectedId(id);
    setTab('words');
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <h1 className="text-lg font-bold text-indigo-600">Memoris · Knowledge</h1>
          <nav className="flex gap-1 text-sm">
            {(['words', 'graph', 'review'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 font-medium capitalize ${
                  tab === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">
        {tab === 'words' && (
          <Words selectedId={selectedId} setSelectedId={setSelectedId} onOpen={openConcept} />
        )}
        {tab === 'graph' && <GraphView onOpen={openConcept} />}
        {tab === 'review' && <ReviewPanel />}
      </main>
    </div>
  );
}

function Words({
  selectedId,
  setSelectedId,
  onOpen,
}: {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const [concepts, setConcepts] = useState<StoredConcept[]>([]);
  const [domainMap, setDomainMap] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('seen');
  const [domain, setDomain] = useState('all');

  async function reload() {
    const brain = getBrain();
    setConcepts(await brain.listConcepts());
    setDomainMap(await brain.domainsByConcept());
  }
  useEffect(() => {
    void reload();
  }, []);

  const domains = useMemo(() => {
    const s = new Set<string>();
    Object.values(domainMap).forEach((ds) => ds.forEach((d) => s.add(d)));
    return [...s].sort();
  }, [domainMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = concepts.filter((c) => {
      if (q && !c.text.toLowerCase().includes(q) && !(c.gloss ?? '').toLowerCase().includes(q)) return false;
      if (domain !== 'all' && !(domainMap[c.id] ?? []).includes(domain)) return false;
      return true;
    });
    const by: Record<Sort, (a: StoredConcept, b: StoredConcept) => number> = {
      seen: (a, b) => b.encounterCount - a.encounterCount,
      mastery: (a, b) => a.review.mastery - b.review.mastery,
      recent: (a, b) => b.firstSeen.localeCompare(a.firstSeen),
    };
    return [...list].sort(by[sort]);
  }, [concepts, query, sort, domain, domainMap]);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.2fr]">
      <section>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search words / gloss…"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-md border border-slate-300 px-2 text-sm">
            <option value="seen">Most seen</option>
            <option value="mastery">Weakest</option>
            <option value="recent">Recent</option>
          </select>
          <select value={domain} onChange={(e) => setDomain(e.target.value)} className="rounded-md border border-slate-300 px-2 text-sm">
            <option value="all">All sources</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <p className="mb-2 text-xs text-slate-400">{filtered.length} concept(s)</p>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-50 ${
                  selectedId === c.id ? 'bg-indigo-50' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="font-medium text-slate-800">{c.text}</span>
                  <span className="ml-2 text-xs text-slate-400">{c.type}</span>
                  {c.gloss && <span className="block truncate text-xs text-slate-500">{c.gloss}</span>}
                  <span className="mt-1 flex flex-wrap gap-1">
                    {(domainMap[c.id] ?? []).slice(0, 3).map((d) => (
                      <span key={d} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                        {d}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{c.encounterCount}×</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-slate-400">No words match.</li>
          )}
        </ul>
      </section>

      <section>
        {selectedId ? (
          <Detail
            key={selectedId}
            conceptId={selectedId}
            domains={domainMap[selectedId] ?? []}
            onOpen={onOpen}
            onChanged={reload}
            onDeleted={() => {
              setSelectedId(null);
              void reload();
            }}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
            Select a word to see its sources, related words, and edit it.
          </div>
        )}
      </section>
    </div>
  );
}

function Detail({
  conceptId,
  domains,
  onOpen,
  onChanged,
  onDeleted,
}: {
  conceptId: string;
  domains: string[];
  onOpen: (id: string) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [concept, setConcept] = useState<StoredConcept | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [related, setRelated] = useState<{ concept: StoredConcept; similarity: number }[]>([]);
  const [gloss, setGloss] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const brain = getBrain();
      const c = await brain.getConcept(conceptId);
      setConcept(c ?? null);
      setGloss(c?.gloss ?? '');
      setNotes(c?.notes ?? '');
      setEncounters(await brain.conceptEncounters(conceptId));
      setRelated(await brain.relatedConcepts(conceptId, { k: 8, minSim: 0.45 }));
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
          {domains.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {domains.map((d) => (
                <span key={d} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {d}
                </span>
              ))}
            </p>
          )}
        </div>
        <button onClick={() => void remove()} className="text-xs text-rose-500 hover:text-rose-700">
          Delete
        </button>
      </div>

      <label className="mt-4 block text-xs font-medium text-slate-500">Gloss</label>
      <input value={gloss} onChange={(e) => setGloss(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <label className="mt-3 block text-xs font-medium text-slate-500">Your notes</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Mnemonics, personal reminders…" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
      <button onClick={() => void save()} className="mt-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500">
        {saved ? 'Saved ✓' : 'Save'}
      </button>

      {related.length > 0 && (
        <>
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">Related words</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {related.map((r) => (
              <button
                key={r.concept.id}
                onClick={() => onOpen(r.concept.id)}
                title={`${Math.round(r.similarity * 100)}% similar`}
                className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              >
                {r.concept.text}
              </button>
            ))}
          </div>
        </>
      )}

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

// ---- Graph view: nodes = concepts, edges = typed links + top semantic neighbors ----
interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  r: number;
}

function GraphView({ onOpen }: { onOpen: (id: string) => void }) {
  const [data, setData] = useState<{ nodes: Node[]; edges: [number, number][] } | null>(null);
  const W = 900;
  const H = 560;

  useEffect(() => {
    void (async () => {
      const brain = getBrain();
      const all = await brain.listConcepts();
      const links = await brain.listLinks();
      // Cap to the most-encountered concepts for readability.
      const top = [...all].sort((a, b) => b.encounterCount - a.encounterCount).slice(0, 60);
      const idx = new Map(top.map((c, i) => [c.id, i]));

      const edgeSet = new Set<string>();
      const edges: [number, number][] = [];
      const addEdge = (a: number, b: number) => {
        if (a === b) return;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (edgeSet.has(key)) return;
        edgeSet.add(key);
        edges.push([a, b]);
      };
      // Typed links.
      for (const l of links) {
        const a = idx.get(l.fromConceptId);
        const b = idx.get(l.toConceptId);
        if (a !== undefined && b !== undefined) addEdge(a, b);
      }
      // Top-2 semantic neighbors per node.
      for (let i = 0; i < top.length; i++) {
        const ci = top[i]!;
        if (!ci.embedding?.length) continue;
        const sims: { j: number; s: number }[] = [];
        for (let j = 0; j < top.length; j++) {
          const cj = top[j]!;
          if (i === j || !cj.embedding?.length) continue;
          sims.push({ j, s: cosineSimilarity(ci.embedding, cj.embedding) });
        }
        sims.sort((a, b) => b.s - a.s);
        for (const { j, s } of sims.slice(0, 2)) if (s >= 0.55) addEdge(i, j);
      }

      // Deterministic circle init + a few force-sim iterations.
      const N = top.length || 1;
      const nodes: Node[] = top.map((c, i) => ({
        id: c.id,
        text: c.text,
        x: W / 2 + Math.cos((2 * Math.PI * i) / N) * 220,
        y: H / 2 + Math.sin((2 * Math.PI * i) / N) * 200,
        r: 6 + Math.min(10, c.encounterCount),
      }));
      for (let iter = 0; iter < 200; iter++) {
        // Repulsion.
        for (let a = 0; a < nodes.length; a++) {
          for (let b = a + 1; b < nodes.length; b++) {
            const na = nodes[a]!;
            const nb = nodes[b]!;
            let dx = na.x - nb.x;
            let dy = na.y - nb.y;
            const d2 = dx * dx + dy * dy || 0.01;
            const f = 2600 / d2;
            const d = Math.sqrt(d2);
            dx /= d;
            dy /= d;
            na.x += dx * f;
            na.y += dy * f;
            nb.x -= dx * f;
            nb.y -= dy * f;
          }
        }
        // Springs on edges.
        for (const [a, b] of edges) {
          const na = nodes[a]!;
          const nb = nodes[b]!;
          const dx = nb.x - na.x;
          const dy = nb.y - na.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const f = (d - 90) * 0.02;
          na.x += (dx / d) * f;
          na.y += (dy / d) * f;
          nb.x -= (dx / d) * f;
          nb.y -= (dy / d) * f;
        }
        // Keep in bounds.
        for (const n of nodes) {
          n.x = Math.max(20, Math.min(W - 20, n.x));
          n.y = Math.max(20, Math.min(H - 20, n.y));
        }
      }
      setData({ nodes, edges });
    })();
  }, []);

  if (!data) return <p className="text-sm text-slate-500">Building graph…</p>;
  if (data.nodes.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
        No concepts yet — save a few words to see the graph.
      </div>
    );

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <p className="px-4 pt-3 text-xs text-slate-400">
        {data.nodes.length} concepts · edges = shared source / same idea. Click a node to open it.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[700px]">
        {data.edges.map(([a, b], i) => {
          const na = data.nodes[a]!;
          const nb = data.nodes[b]!;
          return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#c7d2fe" strokeWidth={1} />;
        })}
        {data.nodes.map((n) => (
          <g key={n.id} className="cursor-pointer" onClick={() => onOpen(n.id)}>
            <circle cx={n.x} cy={n.y} r={n.r} fill="#6366f1" />
            <text x={n.x} y={n.y - n.r - 3} textAnchor="middle" className="fill-slate-600" fontSize={10}>
              {n.text}
            </text>
          </g>
        ))}
      </svg>
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
        <button onClick={() => setRevealed(true)} className="mt-4 w-full rounded-md border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
          Show meaning
        </button>
      ) : (
        <>
          <p className="mt-3 text-slate-600">{concept?.gloss ?? '(no gloss saved)'}</p>
          {concept?.notes && <p className="mt-1 text-sm text-slate-500">📝 {concept.notes}</p>}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <button key={g.grade} onClick={() => void grade(g.grade)} className={`rounded-md px-2 py-2 text-sm font-medium text-white ${g.cls}`}>
                {g.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
