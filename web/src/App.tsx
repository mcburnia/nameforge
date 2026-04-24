export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand-dark text-white">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Name<span className="text-brand">Forge</span>
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Name availability intelligence
          </p>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Stage 0 scaffold
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              The web app is running. Search form, jurisdiction selector, and
              results dashboard will land in subsequent stages per{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                BACKLOG.md
              </code>
              .
            </p>
          </div>

          <p className="mt-8 text-xs text-slate-500">
            NameForge provides automated availability intelligence only. It is
            not legal advice, does not guarantee registrability, and should not
            replace professional trademark or legal review.
          </p>
        </div>
      </main>
    </div>
  );
}
