import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  getSearchReport,
  reportJsonUrl,
  reportMarkdownUrl,
} from '../lib/api';
import type { SearchReport } from '../lib/types';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { DisclaimerFooter } from '../components/DisclaimerFooter';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; report: SearchReport }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

export function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (!id) {
      setState({ status: 'not-found' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    getSearchReport(id)
      .then((report) => {
        if (!cancelled) setState({ status: 'ready', report });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: 'not-found' });
          return;
        }
        const message =
          err instanceof ApiError
            ? `${err.message} (status ${err.status})`
            : err instanceof Error
              ? err.message
              : 'Request failed';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
        Loading report…
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">Search not found</p>
          <p className="mt-1">No report exists for id {id ?? '—'}.</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center rounded-md bg-brand-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          Start a new search
        </Link>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        <p className="font-semibold">Failed to load report</p>
        <p className="mt-1">{state.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ResultsDashboard
        report={state.report}
        downloadMarkdownUrl={reportMarkdownUrl(state.report.searchId)}
        downloadJsonUrl={reportJsonUrl(state.report.searchId)}
      />
      <DisclaimerFooter />
      <Link
        to="/"
        className="inline-flex items-center text-sm font-medium text-brand hover:underline"
      >
        ← New search
      </Link>
    </div>
  );
}
