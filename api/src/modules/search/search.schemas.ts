import { z } from 'zod';

export const JurisdictionSchema = z.enum(['FR', 'UK', 'EU']);
export const CheckTypeSchema = z.enum(['DOMAIN', 'COMPANY', 'TRADEMARK']);

export const TldSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^\.[a-z][a-z0-9-]{0,62}$/, 'TLD must start with a dot and contain only letters, digits, or hyphens');

export const CreateSearchRequestSchema = z
  .object({
    proposedName: z
      .string()
      .trim()
      .min(1, 'proposedName is required')
      .max(120, 'proposedName must be 120 characters or fewer'),
    jurisdictions: z
      .array(JurisdictionSchema)
      .nonempty('at least one jurisdiction is required'),
    checks: z
      .array(CheckTypeSchema)
      .nonempty('at least one check type is required'),
    domains: z.array(TldSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.checks.includes('DOMAIN') && value.domains.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domains'],
        message: 'at least one TLD is required when DOMAIN check is selected',
      });
    }

    const uniqueJurisdictions = new Set(value.jurisdictions);
    if (uniqueJurisdictions.size !== value.jurisdictions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jurisdictions'],
        message: 'jurisdictions must be unique',
      });
    }

    const uniqueChecks = new Set(value.checks);
    if (uniqueChecks.size !== value.checks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['checks'],
        message: 'checks must be unique',
      });
    }

    const uniqueTlds = new Set(value.domains);
    if (uniqueTlds.size !== value.domains.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domains'],
        message: 'domains must be unique',
      });
    }
  });

export type CreateSearchRequestInput = z.input<typeof CreateSearchRequestSchema>;
export type CreateSearchRequest = z.output<typeof CreateSearchRequestSchema>;
