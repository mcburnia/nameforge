import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, createSearch } from '../lib/api';
import type { CreateSearchInput } from '../lib/types';
import { SearchForm } from '../components/SearchForm';
import { DisclaimerFooter } from '../components/DisclaimerFooter';

export function SearchPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: CreateSearchInput): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      const { searchId } = await createSearch(input);
      navigate(`/searches/${searchId}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.message} (status ${err.status})`
          : err instanceof Error
            ? err.message
            : 'Request failed';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">New search</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter a proposed company or product name. NameForge checks domain
          availability, company-registry conflicts, and trademark conflicts
          across the jurisdictions you select.
        </p>
      </div>

      <SearchForm onSubmit={handleSubmit} submitting={submitting} error={error} />

      <DisclaimerFooter />
    </div>
  );
}
