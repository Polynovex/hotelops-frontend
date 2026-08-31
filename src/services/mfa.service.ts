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
  /** Begins enrolment. Safe to call again — it reissues an unconfirmed secret. */
  setup: async (): Promise<MfaSetupResponse> => {
    const { data } = await api.post('/auth/mfa/setup');
    return data;
  },

  verify: async (code: string): Promise<MfaVerifyResponse> => {
    const { data } = await api.post('/auth/mfa/verify', { code: code.trim() });
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
