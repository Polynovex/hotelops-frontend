/**
 * Offline unlock.
 *
 * Signing in always needs the server. Offline unlock only lets someone who
 * already signed in ONLINE on this device, within the last 24 hours, get back
 * in while the connection is down — e.g. after an idle sign-out mid-outage.
 *
 * What is kept on the device, per person: their profile, encrypted with a key
 * derived from their PIN or password (PBKDF2-SHA256, 210,000 rounds →
 * AES-256-GCM). The PIN/password is never stored, and no refresh token is
 * kept, so a cracked copy grants nothing on the server. Five wrong attempts
 * delete that person's copy. When the connection returns, an offline-unlocked
 * session must sign in online again (with the emailed code) before anything
 * syncs.
 */

const STORAGE_KEY = 'hox.offlineUnlock.v1';
export const OFFLINE_UNLOCK_TTL_MS = 24 * 60 * 60 * 1000;
export const OFFLINE_UNLOCK_MAX_ATTEMPTS = 5;
const ITERATIONS = 210_000;
const MAX_ENTRIES = 20;

type Entry = {
  salt: string;
  iv: string;
  data: string;
  savedAt: number;
  attempts: number;
};
type Vault = Record<string, Entry>;

export type UnlockFailure = 'NOT_FOUND' | 'EXPIRED' | 'WRONG_SECRET' | 'LOCKED' | 'UNSUPPORTED';
export type UnlockResult<T> = { ok: true; profile: T } | { ok: false; reason: UnlockFailure; attemptsLeft?: number };

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
/** Web Crypto's typings want an ArrayBuffer-backed view. */
const buf = (bytes: Uint8Array) => bytes as unknown as BufferSource;

const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle ? crypto.subtle : null);

const read = (): Vault => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Vault) : {};
  } catch {
    return {};
  }
};
const write = (vault: Vault) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  } catch {
    /* storage unavailable: offline unlock simply won't be offered */
  }
};

/** Entries are keyed by a hash of the usercode/email, so the list of who used the device is not readable. */
const keyFor = async (identifier: string) => {
  const s = subtle();
  if (!s) return null;
  const digest = await s.digest('SHA-256', enc.encode(`hox-offline:${identifier.trim().toLowerCase()}`));
  return b64(digest);
};

const deriveKey = async (secret: string, salt: Uint8Array) => {
  const s = subtle()!;
  const base = await s.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return s.deriveKey({ name: 'PBKDF2', salt: buf(salt), iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt'
  ]);
};

const purgeExpired = (vault: Vault, now = Date.now()) => {
  for (const [key, entry] of Object.entries(vault)) {
    if (now - entry.savedAt > OFFLINE_UNLOCK_TTL_MS) delete vault[key];
  }
  return vault;
};

/**
 * Called after a successful ONLINE sign-in, with what the person typed.
 * Several identifiers can be saved for one person (usercode and email).
 */
export const rememberForOfflineUnlock = async (identifier: string, secret: string, profile: unknown) => {
  const s = subtle();
  if (!s || !identifier.trim() || !secret) return;
  try {
    const key = await keyFor(identifier);
    if (!key) return;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aes = await deriveKey(secret, salt);
    const data = await s.encrypt({ name: 'AES-GCM', iv: buf(iv) }, aes, enc.encode(JSON.stringify(profile)));
    const vault = purgeExpired(read());
    vault[key] = { salt: b64(salt), iv: b64(iv), data: b64(data), savedAt: Date.now(), attempts: 0 };
    // Keep the newest entries only (shared terminals see many people).
    const newest = Object.entries(vault).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, MAX_ENTRIES);
    write(Object.fromEntries(newest));
  } catch {
    /* never block a sign-in on this */
  }
};

/** Tries to unlock with what the person typed. */
export const unlockOffline = async <T>(identifier: string, secret: string): Promise<UnlockResult<T>> => {
  const s = subtle();
  if (!s) return { ok: false, reason: 'UNSUPPORTED' };
  const key = await keyFor(identifier);
  const vault = read();
  const entry = key ? vault[key] : undefined;
  if (!key || !entry) return { ok: false, reason: 'NOT_FOUND' };
  if (Date.now() - entry.savedAt > OFFLINE_UNLOCK_TTL_MS) {
    delete vault[key];
    write(vault);
    return { ok: false, reason: 'EXPIRED' };
  }
  try {
    const aes = await deriveKey(secret, unb64(entry.salt));
    const plain = await s.decrypt({ name: 'AES-GCM', iv: buf(unb64(entry.iv)) }, aes, buf(unb64(entry.data)));
    entry.attempts = 0;
    write(vault);
    return { ok: true, profile: JSON.parse(dec.decode(plain)) as T };
  } catch {
    entry.attempts += 1;
    if (entry.attempts >= OFFLINE_UNLOCK_MAX_ATTEMPTS) {
      delete vault[key];
      write(vault);
      return { ok: false, reason: 'LOCKED' };
    }
    write(vault);
    return { ok: false, reason: 'WRONG_SECRET', attemptsLeft: OFFLINE_UNLOCK_MAX_ATTEMPTS - entry.attempts };
  }
};

/** Removes a person's saved copy (e.g. when their PIN or password changes). */
export const forgetOfflineUnlock = async (identifier: string) => {
  const key = await keyFor(identifier);
  if (!key) return;
  const vault = read();
  delete vault[key];
  write(vault);
};

export const hasOfflineUnlockEntries = () => Object.keys(purgeExpired(read())).length > 0;

export const unlockFailureMessage = (result: { reason: UnlockFailure; attemptsLeft?: number }) => {
  switch (result.reason) {
    case 'NOT_FOUND':
      return 'Offline unlock only works for someone who signed in online on this device in the last 24 hours.';
    case 'EXPIRED':
      return 'Your offline access on this device has expired. Sign in once you are back online.';
    case 'LOCKED':
      return 'Too many wrong attempts. Offline unlock is now off for you on this device until you sign in online.';
    case 'UNSUPPORTED':
      return 'This device cannot do offline unlock.';
    default:
      return `That is not right. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left.`;
  }
};
