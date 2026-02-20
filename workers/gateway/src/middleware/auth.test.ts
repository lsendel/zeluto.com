import { describe, expect, it } from 'vitest';
import { extractSessionToken } from './auth.js';

describe('extractSessionToken', () => {
  it('extracts token from cookie header', () => {
    const headers = new Headers({
      Cookie: 'better-auth.session_token=abc123; other=xyz',
    });
    expect(extractSessionToken(headers)).toBe('abc123');
  });

  it('returns null when no session cookie', () => {
    const headers = new Headers({ Cookie: 'other=xyz' });
    expect(extractSessionToken(headers)).toBeNull();
  });

  it('returns null when no cookie header', () => {
    const headers = new Headers();
    expect(extractSessionToken(headers)).toBeNull();
  });

  it('handles token with special characters', () => {
    const headers = new Headers({
      Cookie: 'better-auth.session_token=abc.def-123_456; foo=bar',
    });
    expect(extractSessionToken(headers)).toBe('abc.def-123_456');
  });
});
