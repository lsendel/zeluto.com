import { describe, expect, it } from 'vitest';
import {
  IntentTriggerConfigSchema,
  ScoreTriggerConfigSchema,
  TriggerConfigSchema,
} from './trigger-configs.js';

describe('ScoreTriggerConfigSchema', () => {
  it('parses valid score trigger with gte operator', () => {
    const result = ScoreTriggerConfigSchema.safeParse({
      type: 'score',
      operator: 'gte',
      threshold: 80,
    });
    expect(result.success).toBe(true);
  });

  it('parses valid score trigger with lte operator', () => {
    const result = ScoreTriggerConfigSchema.safeParse({
      type: 'score',
      operator: 'lte',
      threshold: 20,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid operator', () => {
    const result = ScoreTriggerConfigSchema.safeParse({
      type: 'score',
      operator: 'contains',
      threshold: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing threshold', () => {
    const result = ScoreTriggerConfigSchema.safeParse({
      type: 'score',
      operator: 'gte',
    });
    expect(result.success).toBe(false);
  });
});

describe('IntentTriggerConfigSchema', () => {
  it('parses valid intent trigger', () => {
    const result = IntentTriggerConfigSchema.safeParse({
      type: 'intent',
      intentType: 'purchase_intent',
      minStrength: 75,
    });
    expect(result.success).toBe(true);
  });

  it('allows omitting optional minStrength', () => {
    const result = IntentTriggerConfigSchema.safeParse({
      type: 'intent',
      intentType: 'demo_request',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty intentType', () => {
    const result = IntentTriggerConfigSchema.safeParse({
      type: 'intent',
      intentType: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects minStrength out of range', () => {
    const result = IntentTriggerConfigSchema.safeParse({
      type: 'intent',
      intentType: 'buy',
      minStrength: 150,
    });
    expect(result.success).toBe(false);
  });
});

describe('TriggerConfigSchema discriminated union', () => {
  it('parses score trigger via union', () => {
    const result = TriggerConfigSchema.safeParse({
      type: 'score',
      operator: 'eq',
      threshold: 100,
    });
    expect(result.success).toBe(true);
  });

  it('parses intent trigger via union', () => {
    const result = TriggerConfigSchema.safeParse({
      type: 'intent',
      intentType: 'pricing_page',
    });
    expect(result.success).toBe(true);
  });

  it('still parses existing event trigger', () => {
    const result = TriggerConfigSchema.safeParse({
      type: 'event',
      eventType: 'contact_created',
    });
    expect(result.success).toBe(true);
  });
});
