import { PrismaClient, CheckType, Jurisdiction, ResultStatus } from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE_SEARCH_ID = '00000000-0000-4000-8000-000000000001';

async function main(): Promise<void> {
  await prisma.searchRequest.upsert({
    where: { id: SAMPLE_SEARCH_ID },
    update: {},
    create: {
      id: SAMPLE_SEARCH_ID,
      proposedName: 'CRANIS2',
      normalisedName: 'cranis2',
      jurisdictions: [Jurisdiction.FR, Jurisdiction.UK, Jurisdiction.EU],
      checks: [CheckType.DOMAIN, CheckType.COMPANY, CheckType.TRADEMARK],
      domains: ['.com', '.fr', '.eu', '.dev'],
      results: {
        create: [
          {
            checkType: CheckType.DOMAIN,
            jurisdiction: null,
            source: 'RDAP-stub',
            status: ResultStatus.AVAILABLE,
            confidence: 1.0,
            riskScore: 0,
            findings: {
              create: [
                {
                  title: 'cranis2.com appears available',
                  description: 'No RDAP record returned for cranis2.com from the stub connector.',
                  matchedName: null,
                  similarityScore: null,
                  riskReason: null,
                },
              ],
            },
            evidence: {
              create: [
                {
                  sourceName: 'RDAP-stub',
                  sourceUrl: null,
                  retrievedAt: new Date(),
                  rawReference: 'stub:cranis2.com:404',
                  summary:
                    'Stub connector returned 404 for cranis2.com — treated as AVAILABLE.',
                },
              ],
            },
          },
          {
            checkType: CheckType.COMPANY,
            jurisdiction: Jurisdiction.UK,
            source: 'companies-house-stub',
            status: ResultStatus.SIMILAR_FOUND,
            confidence: 0.7,
            riskScore: 24,
            findings: {
              create: [
                {
                  title: 'Similar UK company: "Cranis Limited"',
                  description:
                    'UK Companies House stub returned a similar registered name "Cranis Limited".',
                  matchedName: 'Cranis Limited',
                  similarityScore: 0.82,
                  riskReason:
                    'High string similarity to an active UK registered company.',
                },
              ],
            },
            evidence: {
              create: [
                {
                  sourceName: 'companies-house-stub',
                  sourceUrl: null,
                  retrievedAt: new Date(),
                  rawReference: 'stub:uk:Cranis Limited:12345678',
                  summary:
                    'Stub returned one similar active registration; similarity 0.82.',
                },
              ],
            },
          },
        ],
      },
    },
  });

  const searchCount = await prisma.searchRequest.count();
  const resultCount = await prisma.searchResult.count();
  const findingCount = await prisma.finding.count();
  const evidenceCount = await prisma.evidenceRecord.count();

  console.log(
    `Seed complete: ${searchCount} searches, ${resultCount} results, ${findingCount} findings, ${evidenceCount} evidence records.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
