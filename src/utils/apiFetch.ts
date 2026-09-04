import { getApiErrorMessage } from './apiError';

/**
 * `fetch` that fails the way the rest of the app expects.
 *
 * A handful of screens call `fetch` directly rather than going through the
 * axios client, so they miss the interceptor that normalises error messages —
 * and, more importantly, `fetch` does not reject on a 4xx or 5xx. A request had
 * to be explicitly checked with `res.ok`, and where that check was forgotten a
 * failed call looked exactly like a successful one.
 *
 * This throws on a non-2xx with the same shape axios produces, so
 * `getApiErrorMessage` works unchanged on either client.
 */

export class ApiFetchError extends Error {
  /** Mirrors the axios error shape so one extractor handles both. */
  response: { status: number; data: unknown };

  constructor(status: number, data: unknown, fallback: string) {
    const shaped = { response: { status, data } };
    super(getApiErrorMessage(shaped, fallback));
    this.name = 'ApiFetchError';
    this.response = { status, data };
  }
}

type ApiFetchOptions = RequestInit & {
  /** Used only when the server sent nothing usable. */
  fallbackMessage?: string;
};

/**
 * Performs the request and returns the parsed body, throwing on failure.
 *
 * @throws ApiFetchError on a non-2xx, carrying the server's explanation.
 */
export const apiFetch = async <T = unknown>(
  url: string,
  options: ApiFetchOptions = {}
): Promise<T> => {
  const { fallbackMessage = 'The request could not be completed', ...init } = options;

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    // The request never completed — offline, DNS, CORS. Distinguish it from a
    // server that answered with an error.
    throw new ApiFetchError(0, null, 'Could not reach the server. Check your connection.');
  }

  // A 204, or any empty body, has nothing to parse.
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON — an HTML error page from a proxy, most likely. Keep the raw
      // text so the message is at least traceable.
      data = { message: response.ok ? undefined : text.slice(0, 200) };
    }
  }

  if (!response.ok) {
    throw new ApiFetchError(response.status, data, fallbackMessage);
  }

  return data as T;
};
