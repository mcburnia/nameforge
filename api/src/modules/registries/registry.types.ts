import type { Jurisdiction } from '@prisma/client';

export interface RegistryRequest {
  normalisedName: string;
  jurisdiction: Jurisdiction;
}

export type RegistryStatus =
  | 'AVAILABLE'
  | 'EXACT_MATCH'
  | 'SIMILAR_FOUND'
  | 'UNKNOWN'
  | 'ERROR';

export interface RegistryMatch {
  registeredName: string;
  companyNumber?: string;
  similarityScore?: number;
  activeStatus?: string;
}

export interface RegistryResult {
  jurisdiction: Jurisdiction;
  status: RegistryStatus;
  matches: RegistryMatch[];
  retrievedAt: Date;
  source: string;
  rawReference?: string;
}
