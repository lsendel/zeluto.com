import type { FrequencyCap, JourneySettings, ReEntryRule } from '../value-objects/journey-settings.js';

export interface ExecutionRecord {
  status: 'active' | 'completed' | 'failed' | 'canceled';
  startedAt: Date;
  completedAt: Date | null;
}

export interface EntryDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Evaluates whether a contact may enter a journey given its settings
 * and the contact's execution history for that journey.
 */
export function evaluateEntryGuards(
  settings: JourneySettings,
  executions: ExecutionRecord[],
  now: Date = new Date(),
): EntryDecision {
  // Check active execution — never allow concurrent
  const hasActive = executions.some((e) => e.status === 'active');
  if (hasActive) {
    return { allowed: false, reason: 'Contact already has an active execution' };
  }

  // Check re-entry rule
  const reEntryResult = checkReEntry(settings.reEntry, executions, now);
  if (!reEntryResult.allowed) return reEntryResult;

  // Check frequency cap
  if (settings.frequencyCap) {
    const freqResult = checkFrequencyCap(
      settings.frequencyCap,
      executions,
      now,
    );
    if (!freqResult.allowed) return freqResult;
  }

  return { allowed: true };
}

function checkReEntry(
  rule: ReEntryRule,
  executions: ExecutionRecord[],
  now: Date,
): EntryDecision {
  if (rule.type === 'always') {
    return { allowed: true };
  }

  const pastExecutions = executions.filter((e) => e.status !== 'active');

  if (rule.type === 'once') {
    if (pastExecutions.length > 0) {
      return { allowed: false, reason: 'Re-entry not allowed (once only)' };
    }
    return { allowed: true };
  }

  if (rule.type === 'cooldown') {
    const cooldownMs = (rule.cooldownDays ?? 0) * 24 * 60 * 60 * 1000;
    const mostRecent = pastExecutions
      .map((e) => (e.completedAt ?? e.startedAt).getTime())
      .sort((a, b) => b - a)[0];

    if (mostRecent && now.getTime() - mostRecent < cooldownMs) {
      return {
        allowed: false,
        reason: `Re-entry blocked by ${rule.cooldownDays}-day cooldown`,
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

function checkFrequencyCap(
  cap: FrequencyCap,
  executions: ExecutionRecord[],
  now: Date,
): EntryDecision {
  const windowMs = cap.windowDays * 24 * 60 * 60 * 1000;
  const windowStart = now.getTime() - windowMs;

  const countInWindow = executions.filter(
    (e) => e.startedAt.getTime() >= windowStart,
  ).length;

  if (countInWindow >= cap.maxCount) {
    return {
      allowed: false,
      reason: `Frequency cap reached (${cap.maxCount} per ${cap.windowDays} days)`,
    };
  }

  return { allowed: true };
}
