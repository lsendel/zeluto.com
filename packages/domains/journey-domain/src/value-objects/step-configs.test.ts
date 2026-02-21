import { describe, expect, it } from 'vitest';
import {
  ActionLinkedInConfigSchema,
  ActionTaskConfigSchema,
  StepConfigSchema,
} from './step-configs.js';

describe('ActionLinkedInConfigSchema', () => {
  it('parses valid connection request config', () => {
    const result = ActionLinkedInConfigSchema.safeParse({
      type: 'send_linkedin',
      action: 'connection_request',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
      note: 'Hi, would love to connect!',
    });
    expect(result.success).toBe(true);
  });

  it('parses valid message config without note', () => {
    const result = ActionLinkedInConfigSchema.safeParse({
      type: 'send_linkedin',
      action: 'message',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('parses inmail action', () => {
    const result = ActionLinkedInConfigSchema.safeParse({
      type: 'send_linkedin',
      action: 'inmail',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action type', () => {
    const result = ActionLinkedInConfigSchema.safeParse({
      type: 'send_linkedin',
      action: 'follow',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects note exceeding 300 characters', () => {
    const result = ActionLinkedInConfigSchema.safeParse({
      type: 'send_linkedin',
      action: 'connection_request',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
      note: 'x'.repeat(301),
    });
    expect(result.success).toBe(false);
  });
});

describe('ActionTaskConfigSchema', () => {
  it('parses valid task config with all fields', () => {
    const result = ActionTaskConfigSchema.safeParse({
      type: 'create_task',
      title: 'Follow up call',
      description: 'Schedule a call with the prospect',
      assigneeId: '550e8400-e29b-41d4-a716-446655440000',
      dueDays: 3,
      priority: 'high',
    });
    expect(result.success).toBe(true);
  });

  it('parses minimal task config', () => {
    const result = ActionTaskConfigSchema.safeParse({
      type: 'create_task',
      title: 'Review deal',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('medium'); // default
    }
  });

  it('rejects empty title', () => {
    const result = ActionTaskConfigSchema.safeParse({
      type: 'create_task',
      title: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive dueDays', () => {
    const result = ActionTaskConfigSchema.safeParse({
      type: 'create_task',
      title: 'Task',
      dueDays: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('StepConfigSchema discriminated union', () => {
  it('parses linkedin config via union', () => {
    const result = StepConfigSchema.safeParse({
      type: 'send_linkedin',
      action: 'message',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('parses task config via union', () => {
    const result = StepConfigSchema.safeParse({
      type: 'create_task',
      title: 'Call prospect',
    });
    expect(result.success).toBe(true);
  });

  it('still parses existing email config', () => {
    const result = StepConfigSchema.safeParse({
      type: 'send_email',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
      subject: 'Welcome!',
    });
    expect(result.success).toBe(true);
  });
});
