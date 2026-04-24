import type { CheckType, SearchReport } from '../lib/types';
import { ResultCard } from './ResultCard';
import { RiskBadge } from './RiskBadge';

const CHECK_ORDER: CheckType[] = ['DOMAIN', 'COMPANY', 'TRADEMARK'];
const CHECK_LABEL: Record<CheckType, string> = {
  DOMAIN: 'Domains',
  COMPANY: 'Company registers',
  TRADEMARK: 'Trademarks',
};

export function ResultsDashboard({
  report,
  downloadMarkdownUrl,
  downloadJsonUrl,
}: {
  report: SearchReport;
  downloadMarkdownUrl?: string;
  downloadJsonUrl?: string;
}) {
  const grouped: Record<CheckType, typeof report.results> = {
    DOMAIN: [],
    COMPANY: [],
    TRADEMARK: [],
  };
  for (const r of report.results) grouped[r.checkType].push(r);

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{report.proposedName}</h2>
            <p className="mt-1 text-sm text-slate-600">
              Normalised:{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                {report.normalisedName}
              </code>{' '}
              · Search{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                {report.searchId.slice(0, 8)}
              </code>
            </p>
          </div>
          <RiskBadge
            score={report.overallRiskScore}
            level={report.overallRiskLevel}
            size="lg"
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Jurisdictions
            </dt>
            <dd>{report.jurisdictions.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Checks
            </dt>
            <dd>{report.checks.join(', ') || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Domains
            </dt>
            <dd className="font-mono text-xs">
              {report.domains.length > 0 ? report.domains.join(' ') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Results
            </dt>
            <dd>{report.results.length}</dd>
          </div>
        </dl>

        {downloadMarkdownUrl || downloadJsonUrl ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {downloadMarkdownUrl ? (
              <a
                href={downloadMarkdownUrl}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                download={`nameforge-${report.searchId.slice(0, 8)}.md`}
              >
                Download Markdown
              </a>
            ) : null}
            {downloadJsonUrl ? (
              <a
                href={downloadJsonUrl}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                download={`nameforge-${report.searchId.slice(0, 8)}.json`}
              >
                Download JSON
              </a>
            ) : null}
          </div>
        ) : null}
      </header>

      {CHECK_ORDER.map((checkType) => {
        const items = grouped[checkType];
        if (items.length === 0) return null;
        return (
          <section key={checkType} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {CHECK_LABEL[checkType]}
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {items.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
