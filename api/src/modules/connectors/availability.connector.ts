export type SourceType = 'DOMAIN' | 'COMPANY' | 'TRADEMARK';

export interface EvidenceSummary {
  sourceName: string;
  sourceUrl?: string;
  retrievedAt: Date;
  rawReference?: string;
  summary: string;
}

export interface AvailabilityConnector<TRequest, TResult> {
  readonly name: string;
  readonly sourceType: SourceType;
  search(request: TRequest): Promise<TResult>;
  isAvailable(result: TResult): boolean | null;
  summarise(result: TResult): EvidenceSummary[];
}
