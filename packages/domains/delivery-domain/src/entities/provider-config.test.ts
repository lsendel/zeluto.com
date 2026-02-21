import { describe, expect, it } from 'vitest';
import {
  ProviderConfig,
  validateChannelCompatibility,
  validateProviderConfig,
} from './provider-config.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('ProviderConfig', () => {
  describe('channel compatibility', () => {
    it.each([
      ['ses', 'email'],
      ['sendgrid', 'email'],
      ['postmark', 'email'],
      ['custom_smtp', 'email'],
      ['twilio', 'sms'],
      ['fcm', 'push'],
    ] as const)('allows %s on %s channel', (providerType, channel) => {
      expect(() =>
        validateChannelCompatibility(channel, providerType),
      ).not.toThrow();
    });

    it.each([
      ['ses', 'sms'],
      ['ses', 'push'],
      ['sendgrid', 'sms'],
      ['twilio', 'email'],
      ['twilio', 'push'],
      ['fcm', 'email'],
      ['fcm', 'sms'],
    ] as const)('rejects %s on %s channel', (providerType, channel) => {
      expect(() =>
        validateChannelCompatibility(channel, providerType),
      ).toThrow(/does not support channel/);
    });
  });

  describe('config validation', () => {
    it('validates SES requires region, accessKeyId, secretAccessKey', () => {
      expect(() =>
        validateProviderConfig('ses', { region: 'us-east-1' }),
      ).toThrow(/accessKeyId, secretAccessKey/);
    });

    it('passes SES with all required keys', () => {
      expect(() =>
        validateProviderConfig('ses', {
          region: 'us-east-1',
          accessKeyId: 'AKIA...',
          secretAccessKey: 'secret',
        }),
      ).not.toThrow();
    });

    it('validates SendGrid requires apiKey', () => {
      expect(() => validateProviderConfig('sendgrid', {})).toThrow(/apiKey/);
    });

    it('validates Twilio requires accountSid, authToken, fromNumber', () => {
      expect(() =>
        validateProviderConfig('twilio', { accountSid: 'AC...' }),
      ).toThrow(/authToken, fromNumber/);
    });

    it('rejects empty string values as missing', () => {
      expect(() =>
        validateProviderConfig('sendgrid', { apiKey: '' }),
      ).toThrow(/apiKey/);
    });
  });

  describe('create', () => {
    it('creates valid provider config', () => {
      const config = ProviderConfig.create({
        organizationId: ORG_ID,
        channel: 'email',
        providerType: 'ses',
        config: {
          region: 'us-east-1',
          accessKeyId: 'AKIA...',
          secretAccessKey: 'secret',
        },
      });

      expect(config.channel).toBe('email');
      expect(config.providerType).toBe('ses');
      expect(config.isActive).toBe(true);
    });

    it('rejects incompatible channel at creation', () => {
      expect(() =>
        ProviderConfig.create({
          organizationId: ORG_ID,
          channel: 'sms',
          providerType: 'ses',
          config: {
            region: 'us-east-1',
            accessKeyId: 'AKIA...',
            secretAccessKey: 'secret',
          },
        }),
      ).toThrow(/does not support channel/);
    });

    it('rejects missing config keys at creation', () => {
      expect(() =>
        ProviderConfig.create({
          organizationId: ORG_ID,
          channel: 'email',
          providerType: 'sendgrid',
          config: {},
        }),
      ).toThrow(/apiKey/);
    });
  });

  describe('updateConfig', () => {
    it('validates config on update', () => {
      const config = ProviderConfig.create({
        organizationId: ORG_ID,
        channel: 'email',
        providerType: 'sendgrid',
        config: { apiKey: 'SG.valid' },
      });

      expect(() => config.updateConfig({})).toThrow(/apiKey/);
    });
  });
});
