import { api } from './api';

/**
 * The short numeric code that identifies an account at a sign-in keypad.
 *
 * Rotation used to exist only as an administrative action taken on somebody
 * else, scoped to the actor's own property — so an account had no way to
 * replace its own code, and the super admin had nobody above them to do it.
 * This is the self-service half.
 */

export type RegenerateUserCodeResult = { userCode: string };

export const userCodeService = {
  /**
   * Issues a fresh sign-in code for the current account and returns it.
   *
   * The existing PIN is deliberately kept: a code is usually rotated because
   * it leaked, and dropping the PIN at that moment would weaken the account
   * exactly when it needs to hold.
   *
   * @param currentPassword Proves it is the account holder, not merely someone
   *                        holding a valid access token.
   */
  async regenerate(currentPassword: string): Promise<RegenerateUserCodeResult> {
    const { data } = await api.post('/auth/usercode/regenerate', { currentPassword });
    return data;
  }
};
