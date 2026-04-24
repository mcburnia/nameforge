import type { SearchResultDto } from '../lib/types';
import { StatusBadge } from './StatusBadge';

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ResultCard({ result }: { result: SearchResultDto }) {
  const heading = result.jurisdiction
    ? `${result.checkType} — ${result.jurisdiction}`
    : result.checkType;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{heading}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Source: <span className="font-mono">{result.source}</span> · confidence{' '}
            {result.confidence.toFixed(2)} · retrieved {formatTime(result.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={result.status} />
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
            Risk {result.riskScore}
          </span>
        </div>
      </header>

      {result.findings.length > 0 ? (
        <section className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Findings
          </h4>
          <ul className="mt-2 space-y-2">
            {result.findings.map((f) => (
              <li key={f.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">{f.title}</p>
                <p className="mt-0.5 text-slate-700">{f.description}</p>
                <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
                  {f.matchedName ? (
                    <div>
                      <dt className="inline font-semibold">Match:</dt>{' '}
                      <dd className="inline font-mono">{f.matchedName}</dd>
                    </div>
                  ) : null}
                  {f.similarityScore !== null ? (
                    <div>
                      <dt className="inline font-semibold">Similarity:</dt>{' '}
                      <dd className="inline tabular-nums">{f.similarityScore.toFixed(2)}</dd>
                    </div>
                  ) : null}
                  {f.riskReason ? (
                    <div className="w-full text-slate-700">
                      <dt className="inline font-semibold">Risk reason:</dt>{' '}
                      <dd className="inline">{f.riskReason}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.evidence.length > 0 ? (
        <section className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evidence
          </h4>
          <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
            {result.evidence.map((e) => (
              <li key={e.id} className="border-l-2 border-slate-200 pl-3">
                <p>
                  <span className="font-semibold">{e.sourceName}</span>
                  {e.sourceUrl ? (
                    <>
                      {' '}
                      ·{' '}
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand underline"
                      >
                        {e.sourceUrl}
                      </a>
                    </>
                  ) : null}
                  <span className="ml-2 text-slate-500">{formatTime(e.retrievedAt)}</span>
                </p>
                <p className="mt-0.5 text-slate-700">{e.summary}</p>
                {e.rawReference ? (
                  <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                    {e.rawReference}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
