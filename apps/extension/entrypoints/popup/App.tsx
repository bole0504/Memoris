/**
 * Phase 0 popup — a stub that proves the React + Tailwind toolchain builds and renders.
 * Phase 1 turns this into the real account/status surface.
 */
export function App() {
  return (
    <div className="w-72 bg-white p-5 font-sans text-slate-800">
      <h1 className="text-lg font-semibold text-indigo-600">Memoris</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your second brain for working in a second language.
      </p>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-medium text-slate-700">Phase 0 · skeleton</p>
        <p className="mt-1">
          Select text on any page — the capture is logged to the page console. Phase 1 wires it to
          the AI gateway.
        </p>
      </div>
    </div>
  );
}
