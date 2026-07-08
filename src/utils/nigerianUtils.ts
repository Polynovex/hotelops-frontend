export const NIGERIA_TIMEZONE = 'Africa/Lagos';

export const normalizeNigerianPhone = (input: string) => {
  const digits = input.replace(/\D/g, '');

  if (digits.startsWith('234') && digits.length === 13) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }

  return input;
};
