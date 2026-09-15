import { api } from './api';

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  /** PNG data URL rendered server-side, so no QR dependency is needed here. */
  qrDataUrl: string;
  manualEntryKey: string;
}

export interface MfaVerifyResponse {
  message: string;
  /**
   * A replacement access token carrying `mfaEnabled: true`. Must be stored:
   * the server's enrolment gate reads that flag from the token, so keeping the
   * old one leaves the account refused as unenrolled.
   */
  accessToken?: string;
  /** Present only on the call that completes enrolment. Shown once. */
  recoveryCodes?: string[];
  recoveryCodesMessage?: string;
}

export interface MfaStatus {
  enabled: boolean;
  required: boolean;
  enrolledAt: string | null;
  recoveryCodesRemaining: number;
}

export const mfaService = {
  /**
   * Begins enrolment. Safe to call again: an unconfirmed enrolment keeps its
   * secret, so a QR already scanned stays valid. Rejects with
   * MFA_ALREADY_ENABLED when two-factor is on.
   */
  setup: async (): Promise<MfaSetupResponse> => {
    const { data } = await api.post('/auth/mfa/setup');
    return data;
  },

  verify: async (code: string): Promise<MfaVerifyResponse> => {
    const { data } = await api.post('/auth/mfa/verify', { code: code.trim() });
    return data;
  },

  /**
   * Turns two-factor off. Needs the current password, so a stolen session
   * cannot strip the second factor. Refused for platform administrators.
   */
  disable: async (password: string): Promise<{ enabled: false; message: string }> => {
    const { data } = await api.post('/auth/mfa/disable', { password });
    return data;
  },

  status: async (): Promise<MfaStatus> => {
    const { data } = await api.get('/auth/mfa/status');
    return data;
  },

  regenerateRecoveryCodes: async (): Promise<{ codes: string[]; message: string }> => {
    const { data } = await api.post('/auth/mfa/recovery-codes');
    return data;
  }
};

export default mfaService;
