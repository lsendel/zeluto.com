import {
  type SeedProvider,
  type SeedResult,
  SeedResultSchema,
} from '@mauntic/delivery-domain';
import { z } from 'zod';

const SeedResultsArraySchema = z.array(SeedResultSchema);

export interface PlacementRates {
  inboxRate: number;
  spamRate: number;
  missingRate: number;
}

export interface PlacementCounts extends PlacementRates {
  total: number;
  completed: number;
  inbox: number;
  spam: number;
  missing: number;
  pending: number;
}

export interface ProviderPlacementBreakdown extends PlacementCounts {
  provider: SeedProvider;
}

export interface InboxPlacementReport {
  totals: PlacementCounts;
  providers: ProviderPlacementBreakdown[];
}

export interface ProviderTrendEntry {
  provider: SeedProvider;
  current: PlacementCounts;
  previous: PlacementCounts;
  delta: PlacementRates;
}

export function buildInboxPlacementReport(
  seedTests: Array<{ results: unknown }>,
): InboxPlacementReport {
  const totals = createEmptyCounts();
  const byProvider = new Map<SeedProvider, PlacementCounts>();

  for (const seedTest of seedTests) {
    const parsedResults = SeedResultsArraySchema.safeParse(seedTest.results);
    if (!parsedResults.success) {
      continue;
    }

    for (const result of parsedResults.data) {
      applyResult(totals, result);
      const providerCounts = byProvider.get(result.provider) ?? createEmptyCounts();
      applyResult(providerCounts, result);
      byProvider.set(result.provider, providerCounts);
    }
  }

  finalizeCounts(totals);
  const providers = [...byProvider.entries()]
    .map(([provider, counts]) => {
      finalizeCounts(counts);
      return {
        provider,
        ...counts,
      };
    })
    .sort((left, right) => left.provider.localeCompare(right.provider));

  return { totals, providers };
}

export function buildProviderTrendReport(input: {
  current: Array<{ results: unknown }>;
  previous: Array<{ results: unknown }>;
}): ProviderTrendEntry[] {
  const currentReport = buildInboxPlacementReport(input.current);
  const previousReport = buildInboxPlacementReport(input.previous);

  const currentByProvider = new Map(
    currentReport.providers.map((provider) => [provider.provider, provider]),
  );
  const previousByProvider = new Map(
    previousReport.providers.map((provider) => [provider.provider, provider]),
  );

  const providers = [...new Set([...currentByProvider.keys(), ...previousByProvider.keys()])]
    .sort((left, right) => left.localeCompare(right))
    .map((provider) => {
      const current = currentByProvider.get(provider) ?? {
        provider,
        ...createEmptyCounts(),
      };
      const previous = previousByProvider.get(provider) ?? {
        provider,
        ...createEmptyCounts(),
      };

      return {
        provider,
        current: stripProvider(current),
        previous: stripProvider(previous),
        delta: {
          inboxRate: round(current.inboxRate - previous.inboxRate),
          spamRate: round(current.spamRate - previous.spamRate),
          missingRate: round(current.missingRate - previous.missingRate),
        },
      };
    });

  return providers;
}

function createEmptyCounts(): PlacementCounts {
  return {
    total: 0,
    completed: 0,
    inbox: 0,
    spam: 0,
    missing: 0,
    pending: 0,
    inboxRate: 0,
    spamRate: 0,
    missingRate: 0,
  };
}

function applyResult(target: PlacementCounts, result: SeedResult) {
  target.total += 1;

  if (result.placement === 'pending') {
    target.pending += 1;
    return;
  }

  target.completed += 1;
  if (result.placement === 'inbox') {
    target.inbox += 1;
    return;
  }
  if (result.placement === 'spam') {
    target.spam += 1;
    return;
  }
  if (result.placement === 'missing') {
    target.missing += 1;
  }
}

function finalizeCounts(target: PlacementCounts) {
  if (target.completed <= 0) {
    target.inboxRate = 0;
    target.spamRate = 0;
    target.missingRate = 0;
    return;
  }
  target.inboxRate = round((target.inbox / target.completed) * 100);
  target.spamRate = round((target.spam / target.completed) * 100);
  target.missingRate = round((target.missing / target.completed) * 100);
}

function stripProvider(value: ProviderPlacementBreakdown): PlacementCounts {
  return {
    total: value.total,
    completed: value.completed,
    inbox: value.inbox,
    spam: value.spam,
    missing: value.missing,
    pending: value.pending,
    inboxRate: value.inboxRate,
    spamRate: value.spamRate,
    missingRate: value.missingRate,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
