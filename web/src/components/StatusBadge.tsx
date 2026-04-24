import type { ResultStatus } from '../lib/types';

const STYLES: Record<ResultStatus, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  UNAVAILABLE: 'bg-red-50 text-red-800 border-red-200',
  SIMILAR_FOUND: 'bg-amber-50 text-amber-900 border-amber-200',
  UNKNOWN: 'bg-slate-50 text-slate-700 border-slate-200',
  ERROR: 'bg-rose-50 text-rose-800 border-rose-200',
};

export function StatusBadge({ status }: { status: ResultStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${STYLES[status]}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
