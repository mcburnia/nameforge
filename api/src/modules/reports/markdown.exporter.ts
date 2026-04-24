import type {
  EvidenceDto,
  FindingDto,
  SearchReport,
  SearchResultDto,
} from '../search/search.types.js';
import { DISCLAIMER } from './disclaimer.js';

function escapeMd(input: string): string {
  return input.replace(/([|\\`*_{}[\]()#+\-!>])/g, '\\$1');
}

function renderFinding(f: FindingDto): string {
  const lines: string[] = [`- **${escapeMd(f.title)}** — ${escapeMd(f.description)}`];
  if (f.matchedName) lines.push(`  - Matched name: \`${escapeMd(f.matchedName)}\``);
  if (f.similarityScore !== null && f.similarityScore !== undefined) {
    lines.push(`  - Similarity: ${f.similarityScore.toFixed(2)}`);
  }
  if (f.riskReason) lines.push(`  - Risk reason: ${escapeMd(f.riskReason)}`);
  return lines.join('\n');
}

function renderEvidence(e: EvidenceDto): string {
  const url = e.sourceUrl ? ` (<${e.sourceUrl}>)` : '';
  const ref = e.rawReference ? ` \`${escapeMd(e.rawReference)}\`` : '';
  return `- **${escapeMd(e.sourceName)}**${url} @ ${e.retrievedAt}${ref}\n  - ${escapeMd(e.summary)}`;
}

function renderResult(r: SearchResultDto): string {
  const heading =
    `### ${r.checkType}` +
    (r.jurisdiction ? ` — ${r.jurisdiction}` : '') +
    ` _(${r.source})_`;
  const meta = `Status **${r.status}** · Risk score **${r.riskScore}** · Confidence ${r.confidence.toFixed(2)}`;

  const findingsSection =
    r.findings.length > 0
      ? ['#### Findings', ...r.findings.map(renderFinding)].join('\n')
      : '_No findings recorded._';

  const evidenceSection =
    r.evidence.length > 0
      ? ['#### Evidence', ...r.evidence.map(renderEvidence)].join('\n')
      : '_No evidence captured._';

  return [heading, '', meta, '', findingsSection, '', evidenceSection].join('\n');
}

export function renderMarkdownReport(report: SearchReport): string {
  const header = [
    `# NameForge Availability Report — ${escapeMd(report.proposedName)}`,
    '',
    `- **Search ID:** \`${report.searchId}\``,
    `- **Normalised name:** \`${escapeMd(report.normalisedName)}\``,
    `- **Jurisdictions:** ${report.jurisdictions.join(', ') || '_none_'}`,
    `- **Checks:** ${report.checks.join(', ') || '_none_'}`,
    `- **Domains:** ${report.domains.length > 0 ? report.domains.map((d) => '`' + d + '`').join(', ') : '_none_'}`,
    `- **Created at:** ${report.createdAt}`,
    '',
    `## Overall risk`,
    '',
    `**${report.overallRiskScore} / 100 — ${report.overallRiskLevel}**`,
  ].join('\n');

  const resultsSection =
    report.results.length > 0
      ? ['## Results', '', ...report.results.map(renderResult)].join('\n\n')
      : '## Results\n\n_No results._';

  const footer = ['---', '', '> ' + DISCLAIMER].join('\n');

  return [header, resultsSection, footer].join('\n\n') + '\n';
}
