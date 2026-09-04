import { api } from './api';

/**
 * Sign-in PIN management.
 *
 * A PIN is the second half of usercode sign-in — the short code identifies the
 * account, the PIN authenticates it. It can only be set from an authenticated
 * session and requires the account password, so possession of a sign-in code
 * alone is never enough to establish one.
 */

export type SetPinResult = { message: string };

export const pinService = {
  /**
   * Sets or replaces the caller's sign-in PIN.
   *
   * @param pin             4–6 digits. Repeated or sequential runs are refused.
   * @param currentPassword Proves it is really the account holder, not just
   *                        someone holding a valid access token.
   */
  async setPin(pin: string, currentPassword: string): Promise<SetPinResult> {
    const { data } = await api.post('/auth/pin', { pin, currentPassword });
    return data;
  }
};

/** Client-side mirror of the server's rules, so the form can explain up front. */
export const describePinProblem = (pin: string): string | null => {
  const digits = pin.trim();

  if (!/^\d*$/.test(digits)) {
    return 'A PIN can only contain digits.';
  }
  if (digits.length < 4 || digits.length > 6) {
    return 'A PIN must be 4 to 6 digits.';
  }
  if (/^(\d)\1+$/.test(digits)) {
    return 'Avoid a PIN that repeats the same digit.';
  }
  if ('0123456789'.includes(digits) || '9876543210'.includes(digits)) {
    return 'Avoid a PIN that runs in sequence.';
  }
  return null;
};
