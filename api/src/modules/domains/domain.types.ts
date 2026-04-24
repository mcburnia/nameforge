export interface DomainRequest {
  normalisedName: string;
  tld: string;
}

export type DomainStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN' | 'ERROR';

export interface DomainResult {
  fqdn: string;
  tld: string;
  status: DomainStatus;
  retrievedAt: Date;
  source: string;
  rawReference?: string;
  notes?: string;
}
