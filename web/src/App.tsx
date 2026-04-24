import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { SearchPage } from './pages/SearchPage';
import { ResultsPage } from './pages/ResultsPage';

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-brand-dark text-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-3 hover:opacity-90">
            <h1 className="text-2xl font-bold tracking-tight">
              Name<span className="text-brand">Forge</span>
            </h1>
            <span className="text-xs text-slate-300 uppercase tracking-wide">
              Name availability intelligence
            </span>
          </Link>
          <span className="text-xs text-slate-400">Loman Cavendish</span>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">{children}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/searches/:id" element={<ResultsPage />} />
          <Route
            path="*"
            element={
              <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold">Page not found</p>
                <p className="mt-1">
                  <Link to="/" className="text-brand underline">
                    Back to search
                  </Link>
                </p>
              </div>
            }
          />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
