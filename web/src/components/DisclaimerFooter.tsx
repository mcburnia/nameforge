import { DISCLAIMER } from '../lib/disclaimer';

export function DisclaimerFooter() {
  return (
    <p className="mt-10 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">Not legal advice.</span>{' '}
      {DISCLAIMER}
    </p>
  );
}
