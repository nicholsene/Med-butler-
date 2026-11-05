import { describe, expect, it } from 'vitest';
import { smsHref, telHref } from './tel';

it.each([
  ['(555) 010-1234', 'tel:5550101234'],
  ['+1 555 010 1234', 'tel:+15550101234'],
  ['911', 'tel:911'],
])('%s becomes %s', (raw, out) => expect(telHref(raw)).toBe(out));

it.each(['', '   ', '12', 'call me', undefined, null, 'javascript:alert(1)'])('%j gives no link', (raw) => {
  expect(telHref(raw)).toBeNull();
});

describe('smsHref', () => {
  it('fills in the message, encoded', () => {
    expect(smsHref('(555) 555-0100', 'Please call me & soon?')).toBe('sms:5555550100?&body=Please%20call%20me%20%26%20soon%3F');
  });
  it('keeps a leading plus', () => {
    expect(smsHref('+1 555 555 0100', 'Hi')).toBe('sms:+15555550100?&body=Hi');
  });
  it('works with no message', () => {
    expect(smsHref('5555550100', '  ')).toBe('sms:5555550100');
  });
  it('returns null when the number is unusable', () => {
    expect(smsHref('', 'Hi')).toBeNull();
    expect(smsHref('not a number', 'Hi')).toBeNull();
  });
});
