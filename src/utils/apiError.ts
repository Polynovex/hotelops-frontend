/**
 * Turning an API failure into something worth showing a person.
 *
 * The server answers an error with two fields that serve different audiences:
 *
 *   { "error": "PIN_NOT_SET",                     <- machine-readable code
 *     "message": "No sign-in PIN has been set…" } <- written for a human
 *
 * Handlers around the app picked whichever they happened to reach first, so
 * users saw either the bare code `PIN_NOT_SET` or axios's own
 * "Request failed with status code 409" — never the sentence explaining what to
 * do. This settles the order in one place.
 */

type ApiErrorShape = {
  response?: {
    status?: number;
    data?: {
      error?: string;
      message?: string;
      /** Zod validation failures arrive as a list. */
      issues?: Array<{ message?: string; path?: Array<string | number> }>;
    };
  };
  message?: string;
  code?: string;
};

/** Codes that are self-explanatory enough to show when no message accompanies them. */
const READABLE_CODES: Record<string, string> = {
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
  ECONNABORTED: 'The server took too long to respond. Please try again.',
  MODULE_DISABLED: 'That module is switched off for this business.',
  TOKEN_REVOKED: 'Your session has ended. Please sign in again.',
  MFA_ENROLMENT_REQUIRED: 'Two-factor authentication must be set up before continuing.'
};

/**
 * Best human-readable explanation of a failure.
 *
 * Order, most to least useful:
 *   1. the server's `message`  — written for this exact situation
 *   2. the first validation issue — names the offending field
 *   3. a known code translated to plain language
 *   4. the raw code — unfriendly, but still says what happened
 *   5. the caller's fallback
 *
 * Axios's own `error.message` is deliberately last: "Request failed with status
 * code 409" tells the user nothing they can act on.
 */
export const getApiErrorMessage = (err: unknown, fallback = 'Something went wrong'): string => {
  const error = err as ApiErrorShape;
  const data = error?.response?.data;

  if (data?.message) {
    return data.message;
  }

  const issue = data?.issues?.find((entry) => entry.message);
  if (issue?.message) {
    const field = issue.path?.filter((part) => typeof part === 'string').join('.');
    return field ? `${field}: ${issue.message}` : issue.message;
  }

  if (data?.error && READABLE_CODES[data.error]) {
    return READABLE_CODES[data.error];
  }

  // No response at all means the request never completed — a dropped
  // connection, a timeout, or CORS. Say so rather than blaming the server.
  if (!error?.response) {
    if (error?.code && READABLE_CODES[error.code]) {
      return READABLE_CODES[error.code];
    }
    if (error?.message === 'Network Error') {
      return READABLE_CODES.NETWORK_ERROR;
    }
  }

  if (data?.error) {
    return data.error;
  }

  if (error?.message && !/^Request failed with status code/.test(error.message)) {
    return error.message;
  }

  return fallback;
};

/** The machine-readable code, for branching on a specific failure. */
export const getApiErrorCode = (err: unknown): string | null =>
  (err as ApiErrorShape)?.response?.data?.error ?? null;

export const getApiErrorStatus = (err: unknown): number | null =>
  (err as ApiErrorShape)?.response?.status ?? null;
