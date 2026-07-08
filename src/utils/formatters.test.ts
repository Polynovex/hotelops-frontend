import { formatCurrency, formatDate, formatNumber } from './formatters';

describe('formatters', () => {
  it('formats currency in NGN by default', () => {
    const formatted = formatCurrency(125000);
    expect(formatted).toContain('125,000');
  });

  it('formats numbers with thousand separators', () => {
    expect(formatNumber(9876543)).toBe('9,876,543');
  });

  it('returns invalid date for malformed date input', () => {
    expect(formatDate('not-a-date')).toBe('Invalid date');
  });
});
