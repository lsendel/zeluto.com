import { describe, expect, it } from 'vitest';
import type { JourneySettings } from '../value-objects/journey-settings.js';
import { evaluateEntryGuards, type ExecutionRecord } from './entry-guards.js';

const NOW = new Date('2026-02-20T12:00:00Z');

function makeExecution(
  overrides: Partial<ExecutionRecord> = {},
): ExecutionRecord {
  return {
    status: 'completed',
    startedAt: new Date('2026-02-15T10:00:00Z'),
    completedAt: new Date('2026-02-15T12:00:00Z'),
    ...overrides,
  };
}

function makeSettings(
  overrides: Partial<JourneySettings> = {},
): JourneySettings {
  return {
    reEntry: { type: 'always' },
    frequencyCap: null,
    goal: null,
    ...overrides,
  };
}

describe('evaluateEntryGuards', () => {
  // ---- Active execution guard ----
  it('blocks entry when contact has an active execution', () => {
    const result = evaluateEntryGuards(
      makeSettings(),
      [makeExecution({ status: 'active' })],
      NOW,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('active execution');
  });

  it('allows entry when no executions exist', () => {
    const result = evaluateEntryGuards(makeSettings(), [], NOW);
    expect(result.allowed).toBe(true);
  });

  // ---- Re-entry: always ----
  it('allows re-entry with type=always even after multiple completions', () => {
    const result = evaluateEntryGuards(
      makeSettings({ reEntry: { type: 'always' } }),
      [makeExecution(), makeExecution()],
      NOW,
    );
    expect(result.allowed).toBe(true);
  });

  // ---- Re-entry: once ----
  it('blocks re-entry with type=once after any past execution', () => {
    const result = evaluateEntryGuards(
      makeSettings({ reEntry: { type: 'once' } }),
      [makeExecution()],
      NOW,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('once only');
  });

  it('allows first entry with type=once', () => {
    const result = evaluateEntryGuards(
      makeSettings({ reEntry: { type: 'once' } }),
      [],
      NOW,
    );
    expect(result.allowed).toBe(true);
  });

  // ---- Re-entry: cooldown ----
  it('blocks re-entry during cooldown period', () => {
    const result = evaluateEntryGuards(
      makeSettings({ reEntry: { type: 'cooldown', cooldownDays: 7 } }),
      [
        makeExecution({
          completedAt: new Date('2026-02-18T10:00:00Z'), // 2 days ago
        }),
      ],
      NOW,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('7-day cooldown');
  });

  it('allows re-entry after cooldown period expires', () => {
    const result = evaluateEntryGuards(
      makeSettings({ reEntry: { type: 'cooldown', cooldownDays: 3 } }),
      [
        makeExecution({
          completedAt: new Date('2026-02-10T10:00:00Z'), // 10 days ago
        }),
      ],
      NOW,
    );
    expect(result.allowed).toBe(true);
  });

  // ---- Frequency cap ----
  it('blocks entry when frequency cap is reached', () => {
    const result = evaluateEntryGuards(
      makeSettings({
        frequencyCap: { maxCount: 2, windowDays: 30 },
      }),
      [
        makeExecution({ startedAt: new Date('2026-02-10T10:00:00Z') }),
        makeExecution({ startedAt: new Date('2026-02-14T10:00:00Z') }),
      ],
      NOW,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Frequency cap reached');
  });

  it('allows entry when executions fall outside the frequency window', () => {
    const result = evaluateEntryGuards(
      makeSettings({
        frequencyCap: { maxCount: 1, windowDays: 7 },
      }),
      [
        makeExecution({
          startedAt: new Date('2026-01-01T10:00:00Z'), // well outside window
        }),
      ],
      NOW,
    );
    expect(result.allowed).toBe(true);
  });

  it('allows entry when under frequency cap', () => {
    const result = evaluateEntryGuards(
      makeSettings({
        frequencyCap: { maxCount: 3, windowDays: 30 },
      }),
      [makeExecution({ startedAt: new Date('2026-02-10T10:00:00Z') })],
      NOW,
    );
    expect(result.allowed).toBe(true);
  });

  // ---- Combined rules ----
  it('respects both re-entry and frequency cap together', () => {
    const result = evaluateEntryGuards(
      makeSettings({
        reEntry: { type: 'cooldown', cooldownDays: 1 },
        frequencyCap: { maxCount: 5, windowDays: 30 },
      }),
      [
        makeExecution({
          completedAt: new Date('2026-02-19T20:00:00Z'), // < 1 day ago
        }),
      ],
      NOW,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('cooldown');
  });
});
