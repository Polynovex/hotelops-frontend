import { useEffect, useState } from 'react';
import { api } from '../services/api';

/**
 * Room-type names for display. Rooms and reservations store the room type's
 * code (often a generated one like "PMV5RG4KD"); staff should only ever see
 * the name. Loaded once per session and shared by every screen.
 */
let cache: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;

const load = () => {
  if (cache) return Promise.resolve(cache);
  inflight ??= api
    .get('/room-types')
    .then(({ data }) => {
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      cache = new Map(rows.map((row: { code?: string; name?: string }) => [String(row.code ?? ''), String(row.name || row.code || '')]));
      return cache;
    })
    .catch(() => new Map<string, string>())
    .finally(() => {
      inflight = null;
    });
  return inflight;
};

/** Forget the cached names, e.g. after a room type is renamed. */
export const refreshRoomTypeNames = () => {
  cache = null;
  return load();
};

/** Returns a function that turns a room-type code into its name. */
export const useRoomTypeNames = () => {
  const [names, setNames] = useState<Map<string, string>>(cache ?? new Map());
  useEffect(() => {
    let alive = true;
    void load().then((map) => alive && setNames(map));
    return () => {
      alive = false;
    };
  }, []);
  return (code?: string | null) => (code ? names.get(code) ?? code : '');
};
