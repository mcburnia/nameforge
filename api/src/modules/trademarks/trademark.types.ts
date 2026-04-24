import type { Jurisdiction } from '@prisma/client';

export interface TrademarkRequest {
  normalisedName: string;
  jurisdiction: Jurisdiction;
  niceClasses?: number[];
}

export type TrademarkStatus =
  | 'AVAILABLE'
  | 'EXACT_MATCH'
  | 'SIMILAR_FOUND'
  | 'UNKNOWN'
  | 'ERROR';

export interface TrademarkMatch {
  mark: string;
  registrationNumber?: string;
  niceClasses: number[];
  similarityScore?: number;
  status?: string;
}

export interface TrademarkResult {
  jurisdiction: Jurisdiction;
  status: TrademarkStatus;
  matches: TrademarkMatch[];
  retrievedAt: Date;
  source: string;
  rawReference?: string;
}
