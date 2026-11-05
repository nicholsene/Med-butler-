import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanDataFiles } from '../../scripts/check-data.mjs';
import { findContactPatterns, scrubContactDetails } from './contactPatterns.mjs';

// 555-01xx numbers and example.com are reserved for fiction.
describe('findContactPatterns', () => {
  it.each([
    ['someone@example.com', 'email'],
    ['write to a.b+c@mail.example.org today', 'email'],
    ['555-555-0100', 'phone'],
    ['(555) 555-0100', 'phone'],
    ['555.555.0100', 'phone'],
    ['+1 555 555 0100', 'phone'],
    ['5555550100', 'phone'],
    ['+15555550100', 'phone'],
    ['sms:911', 'contact link'],
  ])('finds %s', (text, type) => {
    expect(findContactPatterns(text).map((x) => x.type)).toContain(type);
  });
  it.each([
    ['Call 911'],
    ['Below 90/60, above 180/120'],
    ['2030-01-31'],
    ['https://example.com/article/12345678901'],
    ['Wait 15 minutes, then 100 more'],
    ['{"at": 1893456000000}'],
  ])('leaves %s alone', (text) => {
    expect(findContactPatterns(text)).toEqual([]);
  });
});

describe('scrubContactDetails', () => {
  it('removes contact details and keeps the rest', () => {
    const out = scrubContactDetails('Ring 555-555-0100 or someone@example.com at 12 Sample Road about the dizzy spell');
    expect(out).not.toMatch(/555|example\.com|Sample/);
    expect(out).toContain('about the dizzy spell');
  });
});

describe('data files', () => {
  it('real data files hold no email or phone patterns', () => {
    expect(scanDataFiles()).toEqual([]);
  });
  it('the check catches a planted number and email, and does not echo them', () => {
    const root = mkdtempSync(join(tmpdir(), 'data-check-'));
    mkdirSync(join(root, 'data'));
    writeFileSync(join(root, 'data', 'bad.json'), '{"a":"555-555-0100",\n"b":"someone@example.com"}');
    writeFileSync(join(root, 'data', 'good.json'), '{"a":"nothing here"}');
    expect(scanDataFiles(root, ['data'])).toEqual([
      { file: join('data', 'bad.json'), line: 1, type: 'phone' },
      { file: join('data', 'bad.json'), line: 2, type: 'email' },
    ]);
  });
});
