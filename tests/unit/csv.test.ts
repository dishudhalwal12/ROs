import { describe, expect, it } from 'vitest';

import {
  normalizeSpreadsheetUrl,
  parseCsvText,
  stringifyCsvText,
} from '@/lib/csv';

describe('csv utilities', () => {
  it('parses quoted csv cells and preserves commas inside values', () => {
    const parsed = parseCsvText(
      'Name,Amount,Notes\n"Rovexa, Inc.",42,"Needs follow-up"\nLakshya,18,Ready',
    );

    expect(parsed.headers).toEqual(['Name', 'Amount', 'Notes']);
    expect(parsed.rows).toEqual([
      ['Rovexa, Inc.', '42', 'Needs follow-up'],
      ['Lakshya', '18', 'Ready'],
    ]);
  });

  it('normalizes google sheets links to csv export urls', () => {
    expect(
      normalizeSpreadsheetUrl(
        'https://docs.google.com/spreadsheets/d/abc123456/edit?gid=998877#gid=998877',
      ),
    ).toBe(
      'https://docs.google.com/spreadsheets/d/abc123456/export?format=csv&gid=998877',
    );
  });

  it('stringifies rows back into csv text', () => {
    expect(
      stringifyCsvText(
        ['Name', 'Owner'],
        [
          ['Rovexa', 'Dishu'],
          ['Client, Inc.', 'Lakshya'],
        ],
      ),
    ).toBe('Name,Owner\nRovexa,Dishu\n"Client, Inc.",Lakshya');
  });
});
