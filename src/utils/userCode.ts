/**
 * Usercode masking utility
 * Full code stored in DB. Frontend masks it for display.
 * Pattern: show first digit + asterisks + last digit
 * e.g. 12456 → 1***6   |   124567 → 1****7
 */

export const maskUserCode = (code: string | null | undefined): string => {
  if (!code) return '—';
  const s = code.trim();
  if (s.length < 2) return '*'.repeat(s.length);
  return s[0] + '*'.repeat(s.length - 2) + s[s.length - 1];
};

export const isUserCodeCopied = (key: string): boolean => {
  try {
    return sessionStorage.getItem(`uc_copied_${key}`) === '1';
  } catch {
    return false;
  }
};

export const markUserCodeCopied = (key: string): void => {
  try {
    sessionStorage.setItem(`uc_copied_${key}`, '1');
  } catch {
    // ignore
  }
};
