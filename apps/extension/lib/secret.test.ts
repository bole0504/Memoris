import { describe, it, expect } from 'vitest';
import { looksLikeSecret } from './secret.js';

describe('looksLikeSecret', () => {
  it('flags things that look like credentials', () => {
    expect(looksLikeSecret('sk-or-v1-abcdef0123456789abcdef0123')).toBe(true);
    expect(looksLikeSecret('AKIA1234567890ABCDEF')).toBe(true);
    expect(looksLikeSecret('AIzaSyAdk1RIl3ik5qiX2Og6tGZ2OkTnxO7hbbs')).toBe(true);
    expect(looksLikeSecret('password: hunter2xyz')).toBe(true);
    expect(
      looksLikeSecret(
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV',
      ),
    ).toBe(true);
    expect(looksLikeSecret('4111 1111 1111 1111')).toBe(true);
    expect(looksLikeSecret('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
  });

  it('does not flag normal work text', () => {
    expect(looksLikeSecret('make the webhook handler idempotent')).toBe(false);
    expect(looksLikeSecret('eventual consistency')).toBe(false);
    expect(looksLikeSecret('a')).toBe(false);
    expect(looksLikeSecret('Please review the pull request.')).toBe(false);
  });
});
