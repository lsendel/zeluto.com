import { z } from 'zod';

export const DataQualityScoreSchema = z.object({
  completeness: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
});

export type DataQualityScore = z.infer<typeof DataQualityScoreSchema>;

export function calculateDataQuality(contact: {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  lastEnrichedAt?: Date | null;
}): DataQualityScore {
  const fields = ['email', 'firstName', 'lastName', 'phone', 'company', 'title'] as const;
  const filled = fields.filter(f => contact[f] != null && contact[f] !== '').length;
  const completeness = filled / fields.length;

  const accuracy = contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? 1.0 : 0.5;

  const daysSinceEnrichment = contact.lastEnrichedAt
    ? (Date.now() - contact.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 90;
  const freshness = Math.max(0, 1 - daysSinceEnrichment / 90);

  const overall = completeness * 0.4 + accuracy * 0.3 + freshness * 0.3;

  return { completeness, accuracy, freshness, overall };
}
