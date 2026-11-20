import { describe, it, expect } from '@jest/globals';
import { isValidEmail, emailValidator } from '../../src/utils/email.js';

// Expected results come from the former regex /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
describe('email validation (ReDoS-safe replacement of the former regex)', () => {
  it.each([
    'a@b.co',
    'john.doe@example.com',
    'john-doe_1@sub-domain.example.org',
    'a@b.cc.dd',
    'a@b-c.d.com',
    'user@mail.example.com',
    'x@y.abc'
  ])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    '',
    'plain',
    'a@b',
    'a@b.c',
    'a@b.abcd',
    '@b.com',
    'a@.com',
    'a@b..com',
    '.a@b.com',
    'a.@b.com',
    'a..b@c.com',
    'a--b@c.com',
    'a@b@c.com',
    'a b@c.com',
    'a@-b.com',
    'a@b-.com',
    'a@b.co-m',
    'a@b.co\n',
    'a+tag@b.com'
  ])('rejects %j', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });

  it('leaves empty values to the "required" validator', () => {
    expect(emailValidator.validator('')).toBe(true);
    expect(emailValidator.validator(undefined)).toBe(true);
  });

  it('answers quickly on a crafted ReDoS payload', () => {
    const payload = `${'a.'.repeat(30000)}!`;
    const start = Date.now();
    expect(isValidEmail(`${payload}@b.com`)).toBe(false);
    expect(isValidEmail(`a@${payload}`)).toBe(false);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
