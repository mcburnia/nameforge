import type { RiskLevel } from '../lib/types';

const LEVEL_STYLES: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LOW_MODERATE: 'bg-lime-100 text-lime-800 border-lime-200',
  MODERATE: 'bg-amber-100 text-amber-900 border-amber-200',
  HIGH: 'bg-orange-100 text-orange-900 border-orange-200',
  CRITICAL: 'bg-red-100 text-red-900 border-red-200',
};

export function RiskBadge({
  score,
  level,
  size = 'md',
}: {
  score: number;
  level: RiskLevel;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizing =
    size === 'lg'
      ? 'text-base px-3 py-1.5'
      : size === 'sm'
        ? 'text-xs px-2 py-0.5'
        : 'text-sm px-2.5 py-1';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-medium ${LEVEL_STYLES[level]} ${sizing}`}
    >
      <span className="tabular-nums">{score}/100</span>
      <span className="uppercase tracking-wide">{level.replace('_', ' ')}</span>
    </span>
  );
}
