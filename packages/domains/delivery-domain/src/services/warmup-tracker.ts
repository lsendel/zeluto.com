/**
 * Warmup schedule management for new sending domains/IPs.
 * New domains need gradual volume increases to build sender reputation.
 */

export interface WarmupSchedule {
  /** Day number since warmup started (1-based) */
  day: number;
  /** Maximum emails allowed on that day */
  maxEmails: number;
}

/**
 * Default warmup schedule for new sending domains.
 * Gradually increases from 50 emails/day to 50,000 over 30 days.
 */
export const DEFAULT_WARMUP: WarmupSchedule[] = [
  { day: 1, maxEmails: 50 },
  { day: 2, maxEmails: 100 },
  { day: 3, maxEmails: 250 },
  { day: 4, maxEmails: 500 },
  { day: 5, maxEmails: 1000 },
  { day: 7, maxEmails: 2500 },
  { day: 10, maxEmails: 5000 },
  { day: 14, maxEmails: 10000 },
  { day: 21, maxEmails: 25000 },
  { day: 30, maxEmails: 50000 },
];

/**
 * Get the maximum number of emails allowed for a given day since warmup started.
 * Interpolates between defined schedule points.
 *
 * @param daysSinceStart - Number of days since warmup began (1-based)
 * @param schedule - Optional custom warmup schedule (defaults to DEFAULT_WARMUP)
 * @returns Maximum emails allowed for the given day, or Infinity if warmup is complete
 */
export function getWarmupLimit(
  daysSinceStart: number,
  schedule: WarmupSchedule[] = DEFAULT_WARMUP,
): number {
  if (daysSinceStart < 1) return 0;

  const sorted = [...schedule].sort((a, b) => a.day - b.day);
  const lastEntry = sorted[sorted.length - 1];

  // If past the last day in schedule, warmup is complete - no limit
  if (!lastEntry || daysSinceStart > lastEntry.day) return Infinity;

  // Find the bracket the current day falls into
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (daysSinceStart <= entry.day) {
      // If exactly on a schedule point or before the first, use its limit
      if (i === 0 || daysSinceStart === entry.day) {
        return entry.maxEmails;
      }
      // Interpolate between previous and current entry
      const prev = sorted[i - 1];
      const dayRange = entry.day - prev.day;
      const emailRange = entry.maxEmails - prev.maxEmails;
      const progress = (daysSinceStart - prev.day) / dayRange;
      return Math.floor(prev.maxEmails + emailRange * progress);
    }
  }

  return Infinity;
}

/**
 * Check if warmup is complete for a given number of days since start.
 *
 * @param daysSinceStart - Number of days since warmup began (1-based)
 * @param schedule - Optional custom warmup schedule (defaults to DEFAULT_WARMUP)
 * @returns true if the domain has completed warmup
 */
export function isWarmupComplete(
  daysSinceStart: number,
  schedule: WarmupSchedule[] = DEFAULT_WARMUP,
): boolean {
  const sorted = [...schedule].sort((a, b) => a.day - b.day);
  const lastEntry = sorted[sorted.length - 1];
  if (!lastEntry) return true;
  return daysSinceStart > lastEntry.day;
}

/**
 * Calculate the day number since warmup started.
 *
 * @param startDate - The date warmup started
 * @param now - The current date (defaults to now)
 * @returns Number of days since warmup began (1-based)
 */
export function getDaysSinceStart(
  startDate: Date,
  now: Date = new Date(),
): number {
  const diffMs = now.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

/**
 * Calculate warmup progress percentage.
 *
 * @param daysSinceStart - Number of days since warmup began
 * @param schedule - Optional custom warmup schedule
 * @returns Progress percentage (0-100)
 */
export function getWarmupProgress(
  daysSinceStart: number,
  schedule: WarmupSchedule[] = DEFAULT_WARMUP,
): number {
  const sorted = [...schedule].sort((a, b) => a.day - b.day);
  const lastEntry = sorted[sorted.length - 1];
  if (!lastEntry) return 100;
  if (daysSinceStart >= lastEntry.day) return 100;
  return Math.min(100, Math.round((daysSinceStart / lastEntry.day) * 100));
}
