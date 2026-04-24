import { useMemo, useState } from 'react';
import type { CheckType, CreateSearchInput, Jurisdiction } from '../lib/types';

const JURISDICTIONS: readonly Jurisdiction[] = ['FR', 'UK', 'EU'];
const CHECKS: readonly CheckType[] = ['DOMAIN', 'COMPANY', 'TRADEMARK'];
const DEFAULT_TLDS: readonly string[] = ['.com', '.fr', '.eu', '.dev'];

const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
  FR: 'France',
  UK: 'United Kingdom',
  EU: 'European Union',
};

const CHECK_LABEL: Record<CheckType, string> = {
  DOMAIN: 'Domains',
  COMPANY: 'Company registers',
  TRADEMARK: 'Trademarks',
};

export interface SearchFormProps {
  onSubmit: (input: CreateSearchInput) => void | Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

interface FieldErrors {
  proposedName?: string;
  jurisdictions?: string;
  checks?: string;
  domains?: string;
}

function toggle<T>(set: readonly T[], value: T): T[] {
  return set.includes(value) ? set.filter((v) => v !== value) : [...set, value];
}

function parseTlds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 0),
    ),
  );
}

export function SearchForm({ onSubmit, submitting = false, error = null }: SearchFormProps) {
  const [proposedName, setProposedName] = useState('');
  const [jurisdictions, setJurisdictions] = useState<Jurisdiction[]>([...JURISDICTIONS]);
  const [checks, setChecks] = useState<CheckType[]>([...CHECKS]);
  const [tldsRaw, setTldsRaw] = useState(DEFAULT_TLDS.join(' '));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const domains = useMemo(() => parseTlds(tldsRaw), [tldsRaw]);
  const domainCheckSelected = checks.includes('DOMAIN');

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmed = proposedName.trim();
    if (trimmed.length === 0) errors.proposedName = 'Proposed name is required.';
    else if (trimmed.length > 120)
      errors.proposedName = 'Proposed name must be 120 characters or fewer.';
    if (jurisdictions.length === 0)
      errors.jurisdictions = 'Select at least one jurisdiction.';
    if (checks.length === 0) errors.checks = 'Select at least one check.';
    if (domainCheckSelected && domains.length === 0)
      errors.domains = 'Add at least one TLD (e.g. .com) when checking domains.';
    for (const tld of domains) {
      if (!/^\.[a-z][a-z0-9-]{0,62}$/.test(tld)) {
        errors.domains = `TLD '${tld}' is invalid. Use a leading dot, letters, digits, or hyphens.`;
        break;
      }
    }
    return errors;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    void onSubmit({
      proposedName: proposedName.trim(),
      jurisdictions,
      checks,
      domains: domainCheckSelected ? domains : [],
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      aria-label="Search availability"
    >
      <div>
        <label htmlFor="proposedName" className="block text-sm font-semibold text-slate-900">
          Proposed name
        </label>
        <input
          id="proposedName"
          name="proposedName"
          type="text"
          autoComplete="off"
          value={proposedName}
          onChange={(e) => setProposedName(e.target.value)}
          placeholder="CRANIS2"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          maxLength={120}
          disabled={submitting}
        />
        {fieldErrors.proposedName ? (
          <p className="mt-1 text-xs text-red-700" role="alert">
            {fieldErrors.proposedName}
          </p>
        ) : null}
      </div>

      <fieldset disabled={submitting}>
        <legend className="text-sm font-semibold text-slate-900">Jurisdictions</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {JURISDICTIONS.map((j) => {
            const active = jurisdictions.includes(j);
            return (
              <button
                key={j}
                type="button"
                onClick={() => setJurisdictions((s) => toggle(s, j))}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {j} · {JURISDICTION_LABEL[j]}
              </button>
            );
          })}
        </div>
        {fieldErrors.jurisdictions ? (
          <p className="mt-1 text-xs text-red-700" role="alert">
            {fieldErrors.jurisdictions}
          </p>
        ) : null}
      </fieldset>

      <fieldset disabled={submitting}>
        <legend className="text-sm font-semibold text-slate-900">Checks</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHECKS.map((c) => {
            const active = checks.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => setChecks((s) => toggle(s, c))}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {CHECK_LABEL[c]}
              </button>
            );
          })}
        </div>
        {fieldErrors.checks ? (
          <p className="mt-1 text-xs text-red-700" role="alert">
            {fieldErrors.checks}
          </p>
        ) : null}
      </fieldset>

      {domainCheckSelected ? (
        <div>
          <label htmlFor="tlds" className="block text-sm font-semibold text-slate-900">
            TLDs to check
          </label>
          <input
            id="tlds"
            name="tlds"
            type="text"
            autoComplete="off"
            value={tldsRaw}
            onChange={(e) => setTldsRaw(e.target.value)}
            placeholder=".com .fr .eu .dev"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            disabled={submitting}
          />
          <p className="mt-1 text-xs text-slate-500">
            Separate with spaces or commas. Each TLD must start with a dot.
          </p>
          {fieldErrors.domains ? (
            <p className="mt-1 text-xs text-red-700" role="alert">
              {fieldErrors.domains}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-md bg-brand-dark px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Running search…' : 'Run search'}
      </button>
    </form>
  );
}
