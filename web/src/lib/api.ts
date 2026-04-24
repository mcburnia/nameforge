import type {
  CreateSearchInput,
  CreateSearchResponse,
  SearchReport,
} from './types.js';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleJson<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // swallow — body may not be JSON
  }
  const message =
    body && typeof body === 'object' && 'message' in body
      ? String((body as { message: unknown }).message)
      : `Request failed with status ${res.status}`;
  throw new ApiError(message, res.status, body);
}

export async function createSearch(input: CreateSearchInput): Promise<CreateSearchResponse> {
  const res = await fetch(`${API_BASE}/searches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return handleJson<CreateSearchResponse>(res);
}

export async function getSearchReport(searchId: string): Promise<SearchReport> {
  const res = await fetch(`${API_BASE}/searches/${encodeURIComponent(searchId)}`);
  return handleJson<SearchReport>(res);
}

export function reportMarkdownUrl(searchId: string): string {
  return `${API_BASE}/searches/${encodeURIComponent(searchId)}/report.md`;
}

export function reportJsonUrl(searchId: string): string {
  return `${API_BASE}/searches/${encodeURIComponent(searchId)}/report.json`;
}
