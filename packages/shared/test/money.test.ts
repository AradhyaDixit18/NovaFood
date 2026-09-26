import { describe, expect, it } from 'vitest';
import { formatINR } from '../src/money';

describe('formatINR', () => {
  it('drops decimals for whole rupees and always shows two otherwise', () => {
    expect(formatINR(25000)).toBe('₹250');
    expect(formatINR(24950)).toBe('₹249.50');
    expect(formatINR(2154390)).toBe('₹21,543.90');
    expect(formatINR(1234505)).toBe('₹12,345.05');
  });
});
