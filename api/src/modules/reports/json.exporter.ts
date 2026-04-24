import type { SearchReport } from '../search/search.types.js';
import { DISCLAIMER } from './disclaimer.js';

export interface JsonReport extends SearchReport {
  disclaimer: string;
  format: 'nameforge.report.v1';
}

export function renderJsonReport(report: SearchReport): JsonReport {
  return {
    format: 'nameforge.report.v1',
    disclaimer: DISCLAIMER,
    ...report,
  };
}
