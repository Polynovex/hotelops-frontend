import { api } from './api';
import { useAuthStore } from '../store/authStore';

const PROFILE_KEY = 'hotelopx.v3.profiles';
const QROOM_KEY = 'hotelopx.v3.qroom';
const RESERVATION_KEY = 'hotelopx.v3.reservations';
const ROOM_TYPE_KEY = 'hotelopx.v3.room-types';
const HOUSEKEEPING_KEY = 'hotelopx.v3.housekeeping';
const SETTINGS_KEY = 'hotelopx.v3.settings';
const AUDIT_KEY = 'hotelopx.v3.audit';

const isDemoMode = () => useAuthStore.getState().token?.startsWith('demo-token');

const toArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  const payload = value as { data?: T[]; items?: T[]; rows?: T[] };
  return payload?.data || payload?.items || payload?.rows || [];
};

const getJsonObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const safeParse = <T>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (_error) {
    return fallback;
  }
};

const getStore = <T>(key: string, fallback: T): T => safeParse<T>(localStorage.getItem(key), fallback);
const setStore = <T>(key: string, value: T) => localStorage.setItem(key, JSON.stringify(value));

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type ProfileCategory = 'INDIVIDUAL' | 'COMPANY' | 'TRAVEL_AGENT' | 'SOURCE' | 'GROUP';

export interface ProfileRecord {
  id: string;
  type: ProfileCategory;
  name: string;
  email?: string;
  phone?: string;
  vipLevel?: 'NONE' | 'VIP1' | 'VIP2' | 'VIP3';
  isBlacklisted: boolean;
  blacklistReason?: string;
  totalStays: number;
  lastVisit?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileNoteRecord {
  id: string;
  profileId: string;
  type: 'RESERVATION' | 'FINANCIAL' | 'GENERAL' | 'HOUSEKEEPING';
  title: string;
  content: string;
  createdAt: string;
}

export interface ProfileDocumentRecord {
  id: string;
  profileId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

interface ProfileStore {
  profiles: ProfileRecord[];
  notes: Record<string, ProfileNoteRecord[]>;
  documents: Record<string, ProfileDocumentRecord[]>;
}

const defaultProfileStore: ProfileStore = {
  profiles: [
    {
      id: makeId('company'),
      type: 'COMPANY',
      name: 'Demo Corporate Ltd',
      email: 'travel@democorp.ng',
      phone: '+2348010001111',
      isBlacklisted: false,
      totalStays: 14,
      lastVisit: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        creditLimit: 1500000,
        paymentTerms: 30,
        defaultDiscount: 8
      }
    },
    {
      id: makeId('agent'),
      type: 'TRAVEL_AGENT',
      name: 'Naija Travel Desk',
      email: 'ops@naijatravel.ng',
      phone: '+2348091112222',
      isBlacklisted: false,
      totalStays: 9,
      lastVisit: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        iataNumber: 'IATA-44512',
        commissionRate: 10
      }
    },
    {
      id: makeId('source'),
      type: 'SOURCE',
      name: 'Lagos Chamber of Commerce',
      email: 'hospitality@lcc.ng',
      phone: '+2347051234567',
      isBlacklisted: false,
      totalStays: 4,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: makeId('group'),
      type: 'GROUP',
      name: 'ACME Q2 Leadership Retreat',
      email: 'events@acme.ng',
      phone: '+2348069876543',
      isBlacklisted: false,
      totalStays: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        blockCode: 'ACME-RETREAT',
        eventName: 'Leadership Retreat'
      }
    }
  ],
  notes: {},
  documents: {}
};

const readProfileStore = (): ProfileStore => getStore<ProfileStore>(PROFILE_KEY, defaultProfileStore);
const writeProfileStore = (store: ProfileStore) => setStore(PROFILE_KEY, store);

export interface ProfileQuery {
  type?: ProfileCategory | 'ALL';
  query?: string;
  onlyBlacklisted?: boolean;
}

const profileMatchesQuery = (profile: ProfileRecord, query: string) => {
  const q = query.toLowerCase();
  return (
    profile.name.toLowerCase().includes(q) ||
    (profile.email || '').toLowerCase().includes(q) ||
    (profile.phone || '').toLowerCase().includes(q)
  );
};

const pushAudit = (entry: Omit<AuditRecord, 'id' | 'timestamp'>) => {
  const records = getStore<AuditRecord[]>(AUDIT_KEY, []);
  records.unshift({
    id: makeId('audit'),
    timestamp: new Date().toISOString(),
    ...entry
  });
  setStore(AUDIT_KEY, records.slice(0, 1000));
};

const normalizeProfileType = (value: unknown): ProfileCategory => {
  const raw = String(value || '').toUpperCase();
  if (raw === 'COMPANY') return 'COMPANY';
  if (raw === 'TRAVEL_AGENT') return 'TRAVEL_AGENT';
  if (raw === 'SOURCE') return 'SOURCE';
  if (raw === 'GROUP') return 'GROUP';
  return 'INDIVIDUAL';
};

const mapApiProfile = (raw: Record<string, unknown>): ProfileRecord => {
  const blacklist = raw.blacklist as { isBlacklisted?: boolean; reason?: string } | undefined;
  const firstName = String(raw.firstName || '').trim();
  const lastName = String(raw.lastName || '').trim();
  const type = normalizeProfileType(raw.profileType || raw.type);
  const fallbackName = `${firstName} ${lastName}`.trim() || String(raw.companyName || raw.groupName || 'Profile');

  return {
    id: String(raw.id || makeId('profile')),
    type,
    name: String(raw.name || fallbackName || 'Profile'),
    email: typeof raw.email === 'string' ? raw.email : undefined,
    phone: typeof raw.phone === 'string' ? raw.phone : undefined,
    vipLevel: (raw.vipLevel as ProfileRecord['vipLevel']) || 'NONE',
    isBlacklisted: Boolean(raw.isBlacklisted || blacklist?.isBlacklisted),
    blacklistReason:
      typeof raw.blacklistReason === 'string'
        ? raw.blacklistReason
        : typeof blacklist?.reason === 'string'
          ? blacklist.reason
          : undefined,
    totalStays: Number(raw.totalStays || 0),
    lastVisit:
      typeof raw.lastVisit === 'string'
        ? raw.lastVisit
        : typeof raw.lastStayDate === 'string'
          ? raw.lastStayDate
          : undefined,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
    metadata: raw
  };
};

export const profileOpsService = {
  async listProfiles(query: ProfileQuery = {}): Promise<ProfileRecord[]> {
    const store = readProfileStore();
    let records: ProfileRecord[] = [...store.profiles];

    try {
      if (!isDemoMode()) {
        const response = await api.get('/profiles', {
          params: {
            ...(query.query ? { q: query.query } : {}),
            ...(query.type && query.type !== 'ALL' ? { type: query.type } : {})
          }
        });

        const payload = response.data as { profiles?: Record<string, unknown>[] };
        const apiRows = Array.isArray(payload?.profiles)
          ? payload.profiles.map(mapApiProfile)
          : toArray<Record<string, unknown>>(response.data).map(mapApiProfile);

        if (apiRows.length > 0) {
          const localsById = new Map(store.profiles.map((profile) => [profile.id, profile]));
          records = apiRows.map((profile) => localsById.get(profile.id) || profile);
          const localOnly = store.profiles.filter((profile) => !records.find((item) => item.id === profile.id));
          records = [...records, ...localOnly];
        }
      }
    } catch (_error) {
      // Fallback to local cache when backend is unavailable.
    }

    if (query.type && query.type !== 'ALL') {
      records = records.filter((profile) => profile.type === query.type);
    }

    if (query.onlyBlacklisted) {
      records = records.filter((profile) => profile.isBlacklisted);
    }

    if (query.query) {
      records = records.filter((profile) => profileMatchesQuery(profile, query.query || ''));
    }

    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async createProfile(payload: {
    type: ProfileCategory;
    name: string;
    email?: string;
    phone?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProfileRecord> {
    const now = new Date().toISOString();

    if (!isDemoMode()) {
      try {
        const [firstName, ...lastNameParts] = payload.name.trim().split(' ');
        const endpointByType: Record<ProfileCategory, string> = {
          INDIVIDUAL: '/profiles/individual',
          COMPANY: '/profiles/company',
          TRAVEL_AGENT: '/profiles/travel-agent',
          SOURCE: '/profiles/source',
          GROUP: '/profiles/group'
        };

        const body =
          payload.type === 'INDIVIDUAL'
            ? {
                firstName: firstName || 'Guest',
                lastName: lastNameParts.join(' ') || 'Profile',
                email: payload.email,
                phone: payload.phone,
                ...(payload.metadata || {})
              }
            : {
                name: payload.name,
                email: payload.email,
                phone: payload.phone,
                ...(payload.metadata || {})
              };

        const response = await api.post(endpointByType[payload.type], body);
        const profile = mapApiProfile(response.data as Record<string, unknown>);
        pushAudit({ action: 'CREATE', entity: 'PROFILE', entityId: profile.id, details: { type: payload.type } });
        return profile;
      } catch (_error) {
        // Fall back to local create flow.
      }
    }

    const store = readProfileStore();
    const profile: ProfileRecord = {
      id: makeId('profile'),
      type: payload.type,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      totalStays: 0,
      isBlacklisted: false,
      createdAt: now,
      updatedAt: now,
      metadata: payload.metadata
    };

    store.profiles.unshift(profile);
    writeProfileStore(store);
    pushAudit({ action: 'CREATE', entity: 'PROFILE', entityId: profile.id, details: { type: payload.type } });
    return profile;
  },

  async getProfile(profileId: string): Promise<ProfileRecord | null> {
    try {
      const response = await api.get(`/profiles/${profileId}`);
      return mapApiProfile(response.data as Record<string, unknown>);
    } catch (_error) {
      const store = readProfileStore();
      return store.profiles.find((profile) => profile.id === profileId) || null;
    }
  },

  async updateProfile(profileId: string, updates: Partial<ProfileRecord>): Promise<ProfileRecord | null> {
    if (!isDemoMode()) {
      try {
        const [firstName, ...lastNameParts] = String(updates.name || '').trim().split(' ');
        const response = await api.put(`/profiles/${profileId}`, {
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.name ? { firstName: firstName || undefined, lastName: lastNameParts.join(' ') || undefined } : {}),
          ...(updates.email !== undefined ? { email: updates.email } : {}),
          ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
          ...(updates.metadata || {})
        });
        const profile = mapApiProfile(response.data as Record<string, unknown>);
        pushAudit({ action: 'UPDATE', entity: 'PROFILE', entityId: profileId, details: updates });
        return profile;
      } catch (_error) {
        // Fall back to local cache update.
      }
    }

    const store = readProfileStore();
    const index = store.profiles.findIndex((profile) => profile.id === profileId);
    if (index === -1) {
      return null;
    }

    const updated: ProfileRecord = {
      ...store.profiles[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    store.profiles[index] = updated;
    writeProfileStore(store);
    pushAudit({ action: 'UPDATE', entity: 'PROFILE', entityId: profileId, details: updates });
    return updated;
  },

  async blacklistProfile(profileId: string, reason: string): Promise<void> {
    if (!isDemoMode()) {
      try {
        await api.post(`/profiles/${profileId}/blacklist`, { reason });
        pushAudit({ action: 'BLACKLIST', entity: 'PROFILE', entityId: profileId, details: { reason } });
        return;
      } catch (_error) {
        // Fall back to local cache update.
      }
    }

    await this.updateProfile(profileId, {
      isBlacklisted: true,
      blacklistReason: reason
    });
  },

  async mergeProfiles(sourceId: string, targetId: string): Promise<void> {
    if (!isDemoMode()) {
      try {
        await api.post(`/profiles/${sourceId}/merge/${targetId}`);
        pushAudit({ action: 'MERGE', entity: 'PROFILE', entityId: targetId, details: { sourceId } });
        return;
      } catch (_error) {
        // Fall back to local merge behavior.
      }
    }

    const store = readProfileStore();
    const source = store.profiles.find((profile) => profile.id === sourceId);
    const target = store.profiles.find((profile) => profile.id === targetId);

    if (!source || !target) {
      return;
    }

    target.totalStays += source.totalStays;
    if (!target.email && source.email) {
      target.email = source.email;
    }
    if (!target.phone && source.phone) {
      target.phone = source.phone;
    }
    target.updatedAt = new Date().toISOString();

    store.profiles = store.profiles.filter((profile) => profile.id !== sourceId);

    const sourceNotes = store.notes[sourceId] || [];
    store.notes[targetId] = [...(store.notes[targetId] || []), ...sourceNotes];
    delete store.notes[sourceId];

    const sourceDocuments = store.documents[sourceId] || [];
    store.documents[targetId] = [...(store.documents[targetId] || []), ...sourceDocuments];
    delete store.documents[sourceId];

    writeProfileStore(store);
    pushAudit({ action: 'MERGE', entity: 'PROFILE', entityId: targetId, details: { sourceId } });
  },

  async listNotes(profileId: string): Promise<ProfileNoteRecord[]> {
    if (!isDemoMode()) {
      try {
        const response = await api.get(`/profiles/${profileId}/notes`);
        const rows = toArray<Record<string, unknown>>(response.data).map((row) => ({
          id: String(row.id || makeId('note')),
          profileId,
          type: ((row.type as ProfileNoteRecord['type']) || 'GENERAL'),
          title: String(row.title || row.subject || row.note || 'Note'),
          content: String(row.content || row.note || ''),
          createdAt: String(row.createdAt || new Date().toISOString())
        }));
        return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (_error) {
        // Fall back to local notes.
      }
    }

    const store = readProfileStore();
    return (store.notes[profileId] || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async addNote(
    profileId: string,
    payload: Omit<ProfileNoteRecord, 'id' | 'profileId' | 'createdAt'>
  ): Promise<ProfileNoteRecord> {
    if (!isDemoMode()) {
      try {
        const response = await api.post(`/profiles/${profileId}/notes`, payload);
        const row = response.data as Record<string, unknown>;
        const note: ProfileNoteRecord = {
          id: String(row.id || makeId('note')),
          profileId,
          type: ((row.type as ProfileNoteRecord['type']) || payload.type),
          title: String(row.title || payload.title),
          content: String(row.content || payload.content),
          createdAt: String(row.createdAt || new Date().toISOString())
        };
        pushAudit({ action: 'CREATE', entity: 'PROFILE_NOTE', entityId: note.id, details: { profileId, type: note.type } });
        return note;
      } catch (_error) {
        // Fall back to local note creation.
      }
    }

    const store = readProfileStore();
    const note: ProfileNoteRecord = {
      id: makeId('note'),
      profileId,
      createdAt: new Date().toISOString(),
      ...payload
    };
    store.notes[profileId] = [note, ...(store.notes[profileId] || [])];
    writeProfileStore(store);
    pushAudit({ action: 'CREATE', entity: 'PROFILE_NOTE', entityId: note.id, details: { profileId, type: note.type } });
    return note;
  },

  async listDocuments(profileId: string): Promise<ProfileDocumentRecord[]> {
    if (!isDemoMode()) {
      try {
        const response = await api.get(`/profiles/${profileId}/documents`);
        const rows = toArray<Record<string, unknown>>(response.data).map((row) => ({
          id: String(row.id || makeId('doc')),
          profileId,
          fileName: String(row.fileName || row.name || 'Document'),
          fileType: String(row.fileType || row.mimeType || 'application/octet-stream'),
          fileSize: Number(row.fileSize || 0),
          uploadedAt: String(row.uploadedAt || row.createdAt || new Date().toISOString())
        }));
        return rows.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
      } catch (_error) {
        // Fall back to local documents.
      }
    }

    const store = readProfileStore();
    return (store.documents[profileId] || []).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },

  async addDocument(
    profileId: string,
    payload: Omit<ProfileDocumentRecord, 'id' | 'profileId' | 'uploadedAt'>
  ): Promise<ProfileDocumentRecord> {
    if (!isDemoMode()) {
      try {
        const response = await api.post(`/profiles/${profileId}/documents`, payload);
        const row = response.data as Record<string, unknown>;
        const document: ProfileDocumentRecord = {
          id: String(row.id || makeId('doc')),
          profileId,
          fileName: String(row.fileName || payload.fileName),
          fileType: String(row.fileType || payload.fileType),
          fileSize: Number(row.fileSize || payload.fileSize),
          uploadedAt: String(row.uploadedAt || row.createdAt || new Date().toISOString())
        };
        pushAudit({ action: 'CREATE', entity: 'PROFILE_DOCUMENT', entityId: document.id, details: { profileId } });
        return document;
      } catch (_error) {
        // Fall back to local document creation.
      }
    }

    const store = readProfileStore();
    const doc: ProfileDocumentRecord = {
      id: makeId('doc'),
      profileId,
      uploadedAt: new Date().toISOString(),
      ...payload
    };

    store.documents[profileId] = [doc, ...(store.documents[profileId] || [])];
    writeProfileStore(store);
    pushAudit({ action: 'CREATE', entity: 'PROFILE_DOCUMENT', entityId: doc.id, details: { profileId } });
    return doc;
  }
};

export interface ReservationRecord {
  id: string;
  bookingNumber: string;
  guestId?: string;
  guestName: string;
  roomId?: string | null;
  roomNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  adults: number;
  children: number;
  requestedRoomType?: string | null;
  groupId?: string | null;
  isQRoom?: boolean;
  qRoomPriority?: number;
  preStayCharging?: boolean;
  queuedAt?: string | null;
}

export interface QRoomRecord extends ReservationRecord {
  createdAt: string;
  priority: number;
}

export interface StayViewRateRecord {
  roomType: string;
  baseRate: number;
  availableRooms: number;
}

export interface StayViewRoomRecord extends RoomRecord {
  guestName?: string;
  reservationId?: string;
  reservations: ReservationRecord[];
}

export interface StayViewPayload {
  range: {
    startDate: string;
    endDate: string;
    days: number;
  };
  summary: {
    totalRooms: number;
    vacant: number;
    occupied: number;
    dirty: number;
    dueOut: number;
    blocked: number;
    unassignedBookings: number;
  };
  rates: StayViewRateRecord[];
  rooms: StayViewRoomRecord[];
  unassignedBookings: ReservationRecord[];
}

export interface GroupRecord {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  memberCount: number;
  assignedRooms: number;
  unassignedRooms: number;
  checkedInCount: number;
  arrivalDate?: string | null;
  departureDate?: string | null;
  balance: number;
  members: ReservationRecord[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const mapBookingToReservation = (booking: Record<string, unknown>): ReservationRecord => {
  const guest = (booking.guest as Record<string, unknown> | undefined) || {};
  const room = (booking.room as Record<string, unknown> | undefined) || {};
  const guestName = `${String(guest.firstName || '')} ${String(guest.lastName || '')}`.trim() || 'Guest';
  const checkIn = String(booking.checkIn || booking.arrivalDate || new Date().toISOString());
  const checkOut = String(booking.checkOut || booking.departureDate || new Date().toISOString());
  const bookingNumber = String(booking.bookingNumber || booking.reservationNumber || booking.id);
  const totalAmount = Number(booking.totalAmount || 0);
  const paidAmount = Number(booking.paidAmount || 0);
  const balance = Number(booking.balance || Math.max(totalAmount - paidAmount, 0));

  return {
    id: String(booking.id),
    bookingNumber,
    guestId: typeof booking.guestId === 'string' ? booking.guestId : undefined,
    guestName,
    roomId:
      typeof booking.roomId === 'string'
        ? booking.roomId
        : typeof room.id === 'string'
          ? String(room.id)
          : null,
    roomNumber: String(room.roomNumber || booking.roomNumber || 'Unassigned'),
    status: String(booking.status || 'RESERVED'),
    checkIn,
    checkOut,
    totalAmount,
    paidAmount,
    balance,
    adults: Number(booking.adults || 1),
    children: Number(booking.children || 0),
    requestedRoomType:
      typeof booking.requestedRoomType === 'string'
        ? booking.requestedRoomType
        : typeof room.roomType === 'string'
          ? String(room.roomType)
          : null,
    groupId: typeof booking.groupId === 'string' ? booking.groupId : null,
    isQRoom: Boolean(booking.isQRoom),
    qRoomPriority: Number(booking.qRoomPriority || 0),
    preStayCharging: Boolean(booking.preStayCharging),
    queuedAt:
      typeof booking.queuedAt === 'string'
        ? booking.queuedAt
        : typeof booking.qRoomQueuedAt === 'string'
          ? booking.qRoomQueuedAt
          : null
  };
};

const listQRoom = (): QRoomRecord[] => getStore<QRoomRecord[]>(QROOM_KEY, []);
const saveQRoom = (rows: QRoomRecord[]) => setStore(QROOM_KEY, rows);

const dateOnly = (value: string) => new Date(value).toISOString().slice(0, 10);

const buildDefaultDemoReservations = (): ReservationRecord[] => {
  const now = new Date();
  const today = new Date(now);
  today.setHours(14, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  return [
    {
      id: makeId('rsv'),
      bookingNumber: `RSV-${Math.floor(Date.now() / 1000)}`,
      guestId: makeId('guest'),
      guestName: 'Aisha Bello',
      roomId: '1',
      roomNumber: '101',
      status: 'CONFIRMED',
      checkIn: today.toISOString(),
      checkOut: tomorrow.toISOString(),
      totalAmount: 125000,
      paidAmount: 0,
      balance: 125000,
      adults: 2,
      children: 0,
      requestedRoomType: 'Standard',
      groupId: null
    },
    {
      id: makeId('rsv'),
      bookingNumber: `RSV-${Math.floor(Date.now() / 1000) + 1}`,
      guestId: makeId('guest'),
      guestName: 'Emeka Okafor',
      roomId: '2',
      roomNumber: '201',
      status: 'CHECKED_IN',
      checkIn: yesterday.toISOString(),
      checkOut: tomorrow.toISOString(),
      totalAmount: 180000,
      paidAmount: 60000,
      balance: 120000,
      adults: 2,
      children: 1,
      requestedRoomType: 'Deluxe',
      groupId: null
    }
  ];
};

const readDemoReservations = (): ReservationRecord[] => {
  const existing = getStore<ReservationRecord[]>(RESERVATION_KEY, []);
  if (existing.length > 0) {
    return existing;
  }

  const seeded = buildDefaultDemoReservations();
  setStore(RESERVATION_KEY, seeded);
  return seeded;
};

const writeDemoReservations = (rows: ReservationRecord[]) => setStore(RESERVATION_KEY, rows);

const sortReservations = (rows: ReservationRecord[]) =>
  rows.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.roomNumber.localeCompare(b.roomNumber));

const mapStayViewPayload = (payload: Record<string, unknown>): StayViewPayload => {
  const rooms = toArray<Record<string, unknown>>(payload.rooms).map((room) => {
    const reservations = toArray<Record<string, unknown>>(room.reservations).map(mapBookingToReservation);
    const currentReservation =
      reservations.find((reservation) => reservation.status === 'CHECKED_IN') || reservations[0];

    return {
      ...mapRoom(room),
      guestName: currentReservation?.guestName,
      reservationId: currentReservation?.id,
      reservations
    };
  });

  return {
    range: {
      startDate: String((payload.range as Record<string, unknown> | undefined)?.startDate || new Date().toISOString()),
      endDate: String((payload.range as Record<string, unknown> | undefined)?.endDate || new Date().toISOString()),
      days: Number((payload.range as Record<string, unknown> | undefined)?.days || 7)
    },
    summary: {
      totalRooms: Number((payload.summary as Record<string, unknown> | undefined)?.totalRooms || rooms.length),
      vacant: Number((payload.summary as Record<string, unknown> | undefined)?.vacant || 0),
      occupied: Number((payload.summary as Record<string, unknown> | undefined)?.occupied || 0),
      dirty: Number((payload.summary as Record<string, unknown> | undefined)?.dirty || 0),
      dueOut: Number((payload.summary as Record<string, unknown> | undefined)?.dueOut || 0),
      blocked: Number((payload.summary as Record<string, unknown> | undefined)?.blocked || 0),
      unassignedBookings: Number((payload.summary as Record<string, unknown> | undefined)?.unassignedBookings || 0)
    },
    rates: toArray<Record<string, unknown>>(payload.rates).map((rate) => ({
      roomType: String(rate.roomType || 'Room'),
      baseRate: Number(rate.baseRate || 0),
      availableRooms: Number(rate.availableRooms || 0)
    })),
    rooms,
    unassignedBookings: toArray<Record<string, unknown>>(payload.unassignedBookings).map(mapBookingToReservation)
  };
};

const mapGroup = (raw: Record<string, unknown>): GroupRecord => ({
  id: String(raw.id || makeId('group')),
  name: String(raw.name || 'Group'),
  email: typeof raw.email === 'string' ? raw.email : undefined,
  phone: typeof raw.phone === 'string' ? raw.phone : undefined,
  memberCount: Number(raw.memberCount || 0),
  assignedRooms: Number(raw.assignedRooms || 0),
  unassignedRooms: Number(raw.unassignedRooms || 0),
  checkedInCount: Number(raw.checkedInCount || 0),
  arrivalDate: typeof raw.arrivalDate === 'string' ? raw.arrivalDate : null,
  departureDate: typeof raw.departureDate === 'string' ? raw.departureDate : null,
  balance: Number(raw.balance || 0),
  members: toArray<Record<string, unknown>>(raw.members).map(mapBookingToReservation),
  metadata: getJsonObject(raw.metadata),
  createdAt: String(raw.createdAt || new Date().toISOString()),
  updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString())
});

export const reservationOpsService = {
  async listReservations(): Promise<ReservationRecord[]> {
    if (isDemoMode()) {
      return sortReservations(readDemoReservations());
    }

    try {
      const response = await api.get('/reservations');
      return sortReservations(toArray<Record<string, unknown>>(response.data).map(mapBookingToReservation));
    } catch (_error) {
      const response = await api.get('/bookings');
      return sortReservations(toArray<Record<string, unknown>>(response.data).map(mapBookingToReservation));
    }
  },

  async getReservation(reservationId: string): Promise<ReservationRecord | null> {
    if (isDemoMode()) {
      const rows = readDemoReservations();
      return rows.find((reservation) => reservation.id === reservationId) || null;
    }

    try {
      const response = await api.get(`/reservations/${reservationId}`);
      return mapBookingToReservation(response.data as Record<string, unknown>);
    } catch (_error) {
      const records = await this.listReservations();
      return records.find((reservation) => reservation.id === reservationId) || null;
    }
  },

  async createReservation(payload: {
    guestId: string;
    roomId?: string;
    requestedRoomType?: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    totalAmount: number;
  }): Promise<ReservationRecord> {
    if (isDemoMode()) {
      const rooms = await roomOpsService.listRooms();
      const room = payload.roomId ? rooms.find((entry) => entry.id === payload.roomId) : undefined;
      const profile = await profileOpsService.getProfile(payload.guestId);
      const created: ReservationRecord = {
        id: makeId('rsv'),
        bookingNumber: `RSV-${Date.now()}`,
        guestId: payload.guestId,
        guestName: profile?.name || `Guest ${payload.guestId.slice(0, 6)}`,
        roomId: payload.roomId || null,
        roomNumber: room?.roomNumber || 'Unassigned',
        status: 'CONFIRMED',
        checkIn: new Date(payload.checkIn).toISOString(),
        checkOut: new Date(payload.checkOut).toISOString(),
        totalAmount: payload.totalAmount,
        paidAmount: 0,
        balance: payload.totalAmount,
        adults: payload.adults,
        children: payload.children,
        requestedRoomType: payload.requestedRoomType || room?.roomType || null,
        groupId: null
      };

      const rows = readDemoReservations();
      rows.unshift(created);
      writeDemoReservations(rows);
      pushAudit({ action: 'CREATE', entity: 'RESERVATION', entityId: created.id, details: payload });
      return created;
    }

    let response;
    try {
      response = await api.post('/reservations', {
        guestId: payload.guestId,
        ...(payload.roomId ? { roomId: payload.roomId } : {}),
        ...(payload.requestedRoomType ? { requestedRoomType: payload.requestedRoomType } : {}),
        arrivalDate: payload.checkIn,
        departureDate: payload.checkOut,
        adults: payload.adults,
        children: payload.children,
        totalAmount: payload.totalAmount
      });
    } catch (_error) {
      response = await api.post('/bookings', payload);
    }

    const reservation = mapBookingToReservation(response.data as Record<string, unknown>);
    pushAudit({ action: 'CREATE', entity: 'RESERVATION', entityId: reservation.id, details: payload });
    return reservation;
  },

  async assignRoom(reservationId: string, roomId: string): Promise<ReservationRecord> {
    if (isDemoMode()) {
      const rooms = await roomOpsService.listRooms();
      const room = rooms.find((entry) => entry.id === roomId);
      const rows = readDemoReservations().map((row) =>
        row.id === reservationId
          ? {
              ...row,
              roomId,
              roomNumber: room?.roomNumber || roomId,
              requestedRoomType: row.requestedRoomType || room?.roomType || null,
              isQRoom: false,
              queuedAt: null
            }
          : row
      );
      writeDemoReservations(rows);
      return rows.find((row) => row.id === reservationId)!;
    }

    const response = await api.post(`/reservations/${reservationId}/assign-room`, { roomId });
    return mapBookingToReservation(response.data as Record<string, unknown>);
  },

  async moveRoom(reservationId: string, roomId: string, reason?: string): Promise<ReservationRecord> {
    if (isDemoMode()) {
      return this.assignRoom(reservationId, roomId);
    }

    const response = await api.post(`/reservations/${reservationId}/move-room/${roomId}`, reason ? { reason } : {});
    return mapBookingToReservation(response.data as Record<string, unknown>);
  },

  async checkIn(reservationId: string): Promise<void> {
    if (isDemoMode()) {
      const rows = readDemoReservations().map((row) =>
        row.id === reservationId ? { ...row, status: 'CHECKED_IN' } : row
      );
      writeDemoReservations(rows);
      pushAudit({ action: 'CHECK_IN', entity: 'RESERVATION', entityId: reservationId, details: {} });
      return;
    }

    try {
      await api.post(`/reservations/${reservationId}/check-in`);
    } catch (_error) {
      try {
        await api.post(`/reservations/${reservationId}/checkin`);
      } catch (_legacyError) {
        await api.post(`/bookings/${reservationId}/check-in`);
      }
    }
    pushAudit({ action: 'CHECK_IN', entity: 'RESERVATION', entityId: reservationId, details: {} });
  },

  async checkOut(reservationId: string): Promise<void> {
    if (isDemoMode()) {
      const rows = readDemoReservations().map((row) =>
        row.id === reservationId ? { ...row, status: 'CHECKED_OUT' } : row
      );
      writeDemoReservations(rows);
      pushAudit({ action: 'CHECK_OUT', entity: 'RESERVATION', entityId: reservationId, details: {} });
      return;
    }

    try {
      await api.post(`/reservations/${reservationId}/check-out`);
    } catch (_error) {
      try {
        await api.post(`/reservations/${reservationId}/checkout`);
      } catch (_legacyError) {
        await api.post(`/bookings/${reservationId}/check-out`);
      }
    }
    pushAudit({ action: 'CHECK_OUT', entity: 'RESERVATION', entityId: reservationId, details: {} });
  },

  async setQRoom(
    reservationId: string,
    payload: { priority?: number; preStayCharging?: boolean; releaseRoom?: boolean } = {}
  ): Promise<ReservationRecord> {
    if (isDemoMode()) {
      const rows = readDemoReservations().map((row) =>
        row.id === reservationId
          ? {
              ...row,
              isQRoom: true,
              qRoomPriority: Number(payload.priority || 0),
              preStayCharging: Boolean(payload.preStayCharging),
              queuedAt: new Date().toISOString(),
              roomId: payload.releaseRoom ? null : row.roomId,
              roomNumber: payload.releaseRoom ? 'Unassigned' : row.roomNumber
            }
          : row
      );
      writeDemoReservations(rows);
      return rows.find((row) => row.id === reservationId)!;
    }

    try {
      const response = await api.post(`/reservations/${reservationId}/q`, payload);
      return mapBookingToReservation(response.data as Record<string, unknown>);
    } catch (_error) {
      const response = await api.post(`/reservations/${reservationId}/q-room`, payload);
      return mapBookingToReservation(response.data as Record<string, unknown>);
    }
  },

  async listArrivals(targetDate: string): Promise<ReservationRecord[]> {
    if (isDemoMode()) {
      const rows = await this.listReservations();
      return rows.filter((row) => dateOnly(row.checkIn) === targetDate && row.status !== 'CHECKED_OUT');
    }

    const today = dateOnly(new Date().toISOString());
    if (targetDate === today) {
      try {
        const response = await api.get('/reservations/arrivals');
        return toArray<Record<string, unknown>>(response.data).map(mapBookingToReservation);
      } catch (_error) {
        // Fall back to filtered list below.
      }
    }

    const rows = await this.listReservations();
    return rows.filter((row) => dateOnly(row.checkIn) === targetDate && row.status !== 'CHECKED_OUT');
  },

  async listDepartures(targetDate: string): Promise<ReservationRecord[]> {
    if (isDemoMode()) {
      const rows = await this.listReservations();
      return rows.filter((row) => dateOnly(row.checkOut) === targetDate && row.status !== 'CHECKED_OUT');
    }

    const today = dateOnly(new Date().toISOString());
    if (targetDate === today) {
      try {
        const response = await api.get('/reservations/departures');
        return toArray<Record<string, unknown>>(response.data).map(mapBookingToReservation);
      } catch (_error) {
        // Fall back to filtered list below.
      }
    }

    const rows = await this.listReservations();
    return rows.filter((row) => dateOnly(row.checkOut) === targetDate && row.status !== 'CHECKED_OUT');
  },

  async listInHouse(targetDate: string): Promise<ReservationRecord[]> {
    if (isDemoMode()) {
      const rows = await this.listReservations();
      return rows.filter(
        (row) =>
          dateOnly(row.checkIn) <= targetDate &&
          dateOnly(row.checkOut) >= targetDate &&
          row.status === 'CHECKED_IN'
      );
    }

    const today = dateOnly(new Date().toISOString());
    if (targetDate === today) {
      try {
        const response = await api.get('/reservations/in-house');
        return toArray<Record<string, unknown>>(response.data).map(mapBookingToReservation);
      } catch (_error) {
        try {
          const response = await api.get('/reservations/inhouse');
          return toArray<Record<string, unknown>>(response.data).map(mapBookingToReservation);
        } catch (_fallbackError) {
          // Fall back to filtered list below.
        }
      }
    }

    const rows = await this.listReservations();
    return rows.filter(
      (row) =>
        dateOnly(row.checkIn) <= targetDate &&
        dateOnly(row.checkOut) >= targetDate &&
        row.status === 'CHECKED_IN'
    );
  },

  async listQRoomQueue(): Promise<QRoomRecord[]> {
    if (isDemoMode()) {
      return this.getQRoomQueue();
    }

    const response = await api.get('/reservations/q-room');
    return toArray<Record<string, unknown>>(response.data)
      .map((row) => {
        const reservation = mapBookingToReservation(row);
        return {
          ...reservation,
          createdAt:
            typeof row.queuedAt === 'string'
              ? row.queuedAt
              : typeof row.qRoomQueuedAt === 'string'
                ? row.qRoomQueuedAt
                : reservation.queuedAt || new Date().toISOString(),
          priority: Number(row.qRoomPriority || row.priority || 0)
        };
      })
      .sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  },

  async assignFromQRoom(reservationId: string, roomId: string): Promise<ReservationRecord> {
    if (isDemoMode()) {
      const assigned = this.assignQRoom(reservationId, roomId);
      return assigned || readDemoReservations().find((row) => row.id === reservationId)!;
    }

    const response = await api.post(`/reservations/${reservationId}/q-room/assign`, { roomId });
    const payload = response.data as { reservation?: Record<string, unknown> } | Record<string, unknown>;
    const raw = 'reservation' in payload && payload.reservation ? payload.reservation : payload;
    return mapBookingToReservation(raw as Record<string, unknown>);
  },

  async listStayView(startDate: string, days: number): Promise<StayViewPayload> {
    if (isDemoMode()) {
      const reservations = await this.listReservations();
      const rooms = await roomOpsService.listRooms();
      return {
        range: {
          startDate,
          endDate: new Date(new Date(startDate).getTime() + (days - 1) * 24 * 60 * 60 * 1000).toISOString(),
          days
        },
        summary: {
          totalRooms: rooms.length,
          vacant: rooms.filter((room) => room.status === 'AVAILABLE').length,
          occupied: rooms.filter((room) => room.status === 'OCCUPIED').length,
          dirty: rooms.filter((room) => room.status === 'CLEANING').length,
          dueOut: reservations.filter((row) => row.status === 'CHECKED_IN' && dateOnly(row.checkOut) === dateOnly(startDate)).length,
          blocked: rooms.filter((room) => room.status === 'MAINTENANCE').length,
          unassignedBookings: reservations.filter((row) => !row.roomId).length
        },
        rates: [],
        rooms: rooms.map((room) => ({
          ...room,
          guestName: reservations.find((reservation) => reservation.roomId === room.id)?.guestName,
          reservationId: reservations.find((reservation) => reservation.roomId === room.id)?.id,
          reservations: reservations.filter((reservation) => reservation.roomId === room.id)
        })),
        unassignedBookings: reservations.filter((reservation) => !reservation.roomId)
      };
    }

    const response = await api.get('/reservations/stay-view', {
      params: {
        startDate,
        days
      }
    });
    return mapStayViewPayload(response.data as Record<string, unknown>);
  },

  getQRoomQueue(): QRoomRecord[] {
    return listQRoom().sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
  },

  addQRoom(payload: { guestName: string; requestedRoomType?: string; priority: number; notes?: string }): QRoomRecord {
    const rows = listQRoom();
    const record: QRoomRecord = {
      id: makeId('qroom'),
      createdAt: new Date().toISOString(),
      bookingNumber: `Q-${Date.now()}`,
      guestName: payload.guestName,
      roomId: null,
      roomNumber: 'Unassigned',
      status: 'Q_ROOM',
      checkIn: new Date().toISOString(),
      checkOut: new Date().toISOString(),
      totalAmount: 0,
      paidAmount: 0,
      balance: 0,
      adults: 1,
      children: 0,
      requestedRoomType: payload.requestedRoomType || null,
      isQRoom: true,
      qRoomPriority: payload.priority,
      queuedAt: new Date().toISOString(),
      priority: payload.priority
    };

    rows.unshift(record);
    saveQRoom(rows);
    pushAudit({ action: 'CREATE', entity: 'QROOM', entityId: record.id, details: payload });
    return record;
  },

  assignQRoom(queueId: string, roomId: string): QRoomRecord | null {
    const rows = listQRoom();
    const index = rows.findIndex((row) => row.id === queueId);
    if (index === -1) {
      return null;
    }

    rows[index] = {
      ...rows[index],
      roomId,
      roomNumber: roomId,
      isQRoom: false
    };
    saveQRoom(rows);
    pushAudit({ action: 'ASSIGN', entity: 'QROOM', entityId: queueId, details: { roomId } });
    return rows[index];
  }
};

export interface RoomRecord {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  rate: number;
  status: string;
}

export interface RoomTypeRecord {
  id: string;
  code: string;
  name: string;
  maxAdults: number;
  maxChildren: number;
  baseRate: number;
  isActive: boolean;
}

const defaultRoomTypes: RoomTypeRecord[] = [
  {
    id: makeId('rtype'),
    code: 'STD',
    name: 'Standard Room',
    maxAdults: 2,
    maxChildren: 1,
    baseRate: 25000,
    isActive: true
  },
  {
    id: makeId('rtype'),
    code: 'DLX',
    name: 'Deluxe Room',
    maxAdults: 2,
    maxChildren: 2,
    baseRate: 40000,
    isActive: true
  },
  {
    id: makeId('rtype'),
    code: 'STE',
    name: 'Executive Suite',
    maxAdults: 4,
    maxChildren: 2,
    baseRate: 75000,
    isActive: true
  }
];

const getRoomTypes = (): RoomTypeRecord[] => getStore<RoomTypeRecord[]>(ROOM_TYPE_KEY, defaultRoomTypes);
const saveRoomTypes = (rows: RoomTypeRecord[]) => setStore(ROOM_TYPE_KEY, rows);

const normalizeRoomStatus = (status: unknown) => {
  const raw = String(status || 'AVAILABLE').toUpperCase();
  if (raw === 'DIRTY') return 'CLEANING';
  if (raw === 'OUT_OF_ORDER' || raw === 'BLOCKED') return 'MAINTENANCE';
  if (raw === 'READY') return 'AVAILABLE';
  return raw;
};

const mapRoom = (room: Record<string, unknown>): RoomRecord => ({
  id: String(room.id),
  roomNumber: String(room.roomNumber || room.number || 'N/A'),
  roomType: String(room.roomType || room.type || 'Standard'),
  floor: Number(room.floor || 1),
  rate: Number(room.rate || 0),
  status: normalizeRoomStatus(room.status)
});

const DEMO_ROOMS_KEY = 'hotelopx.v3.rooms';
const defaultDemoRooms: RoomRecord[] = [
  { id: '1', roomNumber: '101', roomType: 'Standard', floor: 1, rate: 25000, status: 'AVAILABLE' },
  { id: '2', roomNumber: '201', roomType: 'Deluxe', floor: 2, rate: 45000, status: 'OCCUPIED' },
  { id: '3', roomNumber: '301', roomType: 'Suite', floor: 3, rate: 75000, status: 'AVAILABLE' },
  { id: '4', roomNumber: '102', roomType: 'Standard', floor: 1, rate: 25000, status: 'CLEANING' },
  { id: '5', roomNumber: '202', roomType: 'Deluxe', floor: 2, rate: 45000, status: 'AVAILABLE' },
];
const getDemoRooms = (): RoomRecord[] => getStore<RoomRecord[]>(DEMO_ROOMS_KEY, defaultDemoRooms);
const saveDemoRooms = (rows: RoomRecord[]) => setStore(DEMO_ROOMS_KEY, rows);

export const roomOpsService = {
  async listRooms(): Promise<RoomRecord[]> {
    if (isDemoMode()) return getDemoRooms();
    const response = await api.get('/rooms');
    return toArray<Record<string, unknown>>(response.data).map(mapRoom);
  },

  async createRoom(payload: {
    roomNumber: string;
    roomType: string;
    floor: number;
    rate: number;
    status?: string;
  }): Promise<RoomRecord> {
    if (isDemoMode()) {
      const room: RoomRecord = {
        id: makeId('room'),
        roomNumber: payload.roomNumber,
        roomType: payload.roomType,
        floor: payload.floor,
        rate: payload.rate,
        status: normalizeRoomStatus(payload.status || 'AVAILABLE')
      };
      const rows = getDemoRooms();
      rows.push(room);
      saveDemoRooms(rows);
      pushAudit({ action: 'CREATE', entity: 'ROOM', entityId: room.id, details: payload });
      return room;
    }
    const response = await api.post('/rooms', {
      roomNumber: payload.roomNumber,
      roomType: payload.roomType,
      floor: payload.floor,
      rate: payload.rate,
      status: normalizeRoomStatus(payload.status || 'AVAILABLE')
    });

    const room = mapRoom(response.data as Record<string, unknown>);
    pushAudit({ action: 'CREATE', entity: 'ROOM', entityId: room.id, details: payload });
    return room;
  },

  async updateRoomStatus(roomId: string, status: string): Promise<void> {
    const normalized = normalizeRoomStatus(status);
    if (isDemoMode()) {
      const rows = getDemoRooms();
      const idx = rows.findIndex((r) => r.id === roomId);
      if (idx >= 0) { rows[idx] = { ...rows[idx], status: normalized }; saveDemoRooms(rows); }
      pushAudit({ action: 'UPDATE_STATUS', entity: 'ROOM', entityId: roomId, details: { status: normalized } });
      return;
    }
    await api.patch(`/rooms/${roomId}/status`, { status: normalized });
    pushAudit({ action: 'UPDATE_STATUS', entity: 'ROOM', entityId: roomId, details: { status: normalized } });
  },

  async listAvailableRooms(arrivalDate: string, departureDate: string): Promise<RoomRecord[]> {
    if (isDemoMode()) {
      return getDemoRooms().filter((room) => room.status === 'AVAILABLE');
    }

    const response = await api.get('/rooms/available', {
      params: {
        arrivalDate,
        departureDate
      }
    });
    return toArray<Record<string, unknown>>(response.data).map(mapRoom);
  },

  async listRoomTypes(): Promise<RoomTypeRecord[]> {
    if (!isDemoMode()) {
      try {
        const response = await api.get('/room-types');
        const rows = toArray<Record<string, unknown>>(response.data).map((row) => ({
          id: String(row.id || makeId('rtype')),
          code: String(row.code || row.name || 'ROOM'),
          name: String(row.name || row.code || 'Room Type'),
          maxAdults: Number(row.maxAdults || 2),
          maxChildren: Number(row.maxChildren || 0),
          baseRate: Number(row.baseRate || row.rate || 0),
          isActive: row.isActive !== false
        }));

        return rows.sort((a, b) => a.name.localeCompare(b.name));
      } catch (_error) {
        // Fall back to local room type store.
      }
    }

    return getRoomTypes().sort((a, b) => a.name.localeCompare(b.name));
  },

  async createRoomType(payload: Omit<RoomTypeRecord, 'id'>): Promise<RoomTypeRecord> {
    if (!isDemoMode()) {
      try {
        const response = await api.post('/room-types', payload);
        const row = response.data as Record<string, unknown>;
        const roomType: RoomTypeRecord = {
          id: String(row.id || makeId('rtype')),
          code: String(row.code || payload.code),
          name: String(row.name || payload.name),
          maxAdults: Number(row.maxAdults || payload.maxAdults),
          maxChildren: Number(row.maxChildren || payload.maxChildren),
          baseRate: Number(row.baseRate || payload.baseRate),
          isActive: row.isActive !== false
        };
        pushAudit({ action: 'CREATE', entity: 'ROOM_TYPE', entityId: roomType.id, details: payload });
        return roomType;
      } catch (_error) {
        // Fall back to local room type store.
      }
    }

    const rows = getRoomTypes();
    const created: RoomTypeRecord = {
      ...payload,
      id: makeId('rtype')
    };

    rows.unshift(created);
    saveRoomTypes(rows);
    pushAudit({ action: 'CREATE', entity: 'ROOM_TYPE', entityId: created.id, details: payload });
    return created;
  },

  async updateRoomType(
    roomTypeId: string,
    updates: Partial<Omit<RoomTypeRecord, 'id'>>
  ): Promise<RoomTypeRecord | null> {
    if (!isDemoMode()) {
      try {
        const response = await api.put(`/room-types/${roomTypeId}`, updates);
        const row = response.data as Record<string, unknown>;
        const roomType: RoomTypeRecord = {
          id: String(row.id || roomTypeId),
          code: String(row.code || updates.code || ''),
          name: String(row.name || updates.name || 'Room Type'),
          maxAdults: Number(row.maxAdults || updates.maxAdults || 2),
          maxChildren: Number(row.maxChildren || updates.maxChildren || 0),
          baseRate: Number(row.baseRate || updates.baseRate || 0),
          isActive: row.isActive !== false
        };
        pushAudit({ action: 'UPDATE', entity: 'ROOM_TYPE', entityId: roomTypeId, details: updates });
        return roomType;
      } catch (_error) {
        // Fall back to local room type store.
      }
    }

    const rows = getRoomTypes();
    const index = rows.findIndex((row) => row.id === roomTypeId);
    if (index === -1) {
      return null;
    }

    rows[index] = {
      ...rows[index],
      ...updates
    };

    saveRoomTypes(rows);
    pushAudit({ action: 'UPDATE', entity: 'ROOM_TYPE', entityId: roomTypeId, details: updates });
    return rows[index];
  },

  async deleteRoomType(roomTypeId: string): Promise<void> {
    if (!isDemoMode()) {
      try {
        await api.delete(`/room-types/${roomTypeId}`);
        pushAudit({ action: 'DELETE', entity: 'ROOM_TYPE', entityId: roomTypeId, details: {} });
        return;
      } catch (_error) {
        // Fall back to local room type store.
      }
    }

    const rows = getRoomTypes().filter((row) => row.id !== roomTypeId);
    saveRoomTypes(rows);
    pushAudit({ action: 'DELETE', entity: 'ROOM_TYPE', entityId: roomTypeId, details: {} });
  }
};

const GROUP_KEY = 'hotelopx.v3.groups';
const getGroupStore = (): GroupRecord[] => getStore<GroupRecord[]>(GROUP_KEY, []);
const saveGroupStore = (rows: GroupRecord[]) => setStore(GROUP_KEY, rows);

export const groupOpsService = {
  async listGroups(): Promise<GroupRecord[]> {
    if (isDemoMode()) return getGroupStore();
    const response = await api.get('/groups');
    return toArray<Record<string, unknown>>(response.data).map(mapGroup);
  },

  async getGroup(groupId: string): Promise<GroupRecord | null> {
    if (isDemoMode()) return getGroupStore().find((g) => g.id === groupId) || null;
    const response = await api.get(`/groups/${groupId}`);
    return mapGroup(response.data as Record<string, unknown>);
  },

  async createGroup(payload: { name: string; email?: string; phone?: string; metadata?: Record<string, unknown> }) {
    if (isDemoMode()) {
      const group: GroupRecord = {
        id: makeId('group'),
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        memberCount: 0,
        assignedRooms: 0,
        unassignedRooms: 0,
        checkedInCount: 0,
        balance: 0,
        members: [],
        metadata: payload.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const rows = getGroupStore();
      rows.unshift(group);
      saveGroupStore(rows);
      pushAudit({ action: 'CREATE', entity: 'GROUP', entityId: group.id, details: payload });
      return group;
    }
    const response = await api.post('/groups', payload);
    return mapGroup(response.data as Record<string, unknown>);
  },

  async addMember(
    groupId: string,
    payload:
      | { reservationId: string }
      | {
          guestId?: string;
          guest?: { firstName: string; lastName: string; email?: string; phone: string };
          roomId?: string;
          requestedRoomType?: string;
          arrivalDate: string;
          departureDate: string;
          adults?: number;
          children?: number;
          totalAmount?: number;
        }
  ) {
    if (isDemoMode()) {
      const rows = getGroupStore();
      const group = rows.find((g) => g.id === groupId);
      if (group && !('reservationId' in payload)) {
        const guestName = payload.guest
          ? `${payload.guest.firstName} ${payload.guest.lastName}`.trim()
          : 'Group Guest';
        const member: ReservationRecord = {
          id: makeId('rsv'),
          bookingNumber: `RSV-${Date.now()}`,
          guestName,
          roomId: payload.roomId || null,
          roomNumber: 'Unassigned',
          status: 'CONFIRMED',
          checkIn: new Date(payload.arrivalDate).toISOString(),
          checkOut: new Date(payload.departureDate).toISOString(),
          totalAmount: Number(payload.totalAmount || 0),
          paidAmount: 0,
          balance: Number(payload.totalAmount || 0),
          adults: Number(payload.adults || 1),
          children: Number(payload.children || 0),
          requestedRoomType: payload.requestedRoomType || null,
          groupId
        };
        group.members.push(member);
        group.memberCount = group.members.length;
        group.unassignedRooms = group.members.filter((m) => !m.roomId).length;
        group.updatedAt = new Date().toISOString();
        saveGroupStore(rows);
        return member;
      }
      return null;
    }
    const response = await api.post(`/groups/${groupId}/members`, payload);
    return mapBookingToReservation(response.data as Record<string, unknown>);
  },

  async autoAssign(groupId: string) {
    if (isDemoMode()) {
      const rooms = await roomOpsService.listRooms();
      const rows = getGroupStore();
      const group = rows.find((g) => g.id === groupId);
      const assigned: Array<{ reservationId: string; roomId: string; roomNumber: string }> = [];
      const skipped: Array<{ reservationId: string; reason: string }> = [];
      const available = rooms.filter((r) => r.status === 'AVAILABLE');
      if (group) {
        group.members.filter((m) => !m.roomId).forEach((member, i) => {
          const room = available[i];
          if (room) {
            member.roomId = room.id;
            member.roomNumber = room.roomNumber;
            assigned.push({ reservationId: member.id, roomId: room.id, roomNumber: room.roomNumber });
          } else {
            skipped.push({ reservationId: member.id, reason: 'No available room' });
          }
        });
        group.assignedRooms = assigned.length;
        group.unassignedRooms = skipped.length;
        group.updatedAt = new Date().toISOString();
        saveGroupStore(rows);
      }
      return { groupId, assigned, skipped };
    }
    const response = await api.post(`/groups/${groupId}/auto-assign`);
    return response.data as {
      groupId: string;
      assigned: Array<{ reservationId: string; roomId: string; roomNumber: string }>;
      skipped: Array<{ reservationId: string; reason: string }>;
    };
  }
};

export interface HousekeepingTaskRecord {
  id: string;
  roomId: string;
  roomNumber: string;
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  assignee?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LostFoundRecord {
  id: string;
  roomNumber: string;
  itemName: string;
  description?: string;
  status: 'OPEN' | 'RETURNED' | 'DISPOSED';
  createdAt: string;
}

interface HousekeepingStore {
  tasks: HousekeepingTaskRecord[];
  lostFound: LostFoundRecord[];
}

const defaultHousekeepingStore: HousekeepingStore = {
  tasks: [],
  lostFound: []
};

const getHousekeepingStore = (): HousekeepingStore => getStore<HousekeepingStore>(HOUSEKEEPING_KEY, defaultHousekeepingStore);
const saveHousekeepingStore = (store: HousekeepingStore) => setStore(HOUSEKEEPING_KEY, store);

export const housekeepingOpsService = {
  async listTasks(): Promise<HousekeepingTaskRecord[]> {
    const rooms = await roomOpsService.listRooms();
    const store = getHousekeepingStore();
    const roomTaskMap = new Map(store.tasks.map((task) => [task.roomId, task]));

    const generatedTasks: HousekeepingTaskRecord[] = rooms
      .filter((room) => ['CLEANING', 'MAINTENANCE'].includes(room.status))
      .map((room) => {
        const existing = roomTaskMap.get(room.id);
        if (existing) {
          return existing;
        }

        return {
          id: makeId('task'),
          roomId: room.id,
          roomNumber: room.roomNumber,
          title: room.status === 'MAINTENANCE' ? 'Review out-of-order room' : 'Clean and inspect room',
          priority: room.status === 'MAINTENANCE' ? 'HIGH' : 'MEDIUM',
          status: 'TODO',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

    const customTasks = store.tasks.filter((task) => !generatedTasks.find((item) => item.id === task.id));
    const allTasks = [...generatedTasks, ...customTasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    saveHousekeepingStore({
      ...store,
      tasks: allTasks
    });

    return allTasks;
  },

  addTask(payload: {
    roomId: string;
    roomNumber: string;
    title: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    assignee?: string;
  }): HousekeepingTaskRecord {
    const store = getHousekeepingStore();
    const task: HousekeepingTaskRecord = {
      id: makeId('task'),
      ...payload,
      status: 'TODO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    store.tasks.unshift(task);
    saveHousekeepingStore(store);
    pushAudit({ action: 'CREATE', entity: 'HOUSEKEEPING_TASK', entityId: task.id, details: payload });
    return task;
  },

  updateTask(taskId: string, updates: Partial<HousekeepingTaskRecord>): HousekeepingTaskRecord | null {
    const store = getHousekeepingStore();
    const index = store.tasks.findIndex((task) => task.id === taskId);
    if (index === -1) {
      return null;
    }

    store.tasks[index] = {
      ...store.tasks[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveHousekeepingStore(store);
    pushAudit({ action: 'UPDATE', entity: 'HOUSEKEEPING_TASK', entityId: taskId, details: updates });
    return store.tasks[index];
  },

  listLostFound(): LostFoundRecord[] {
    return getHousekeepingStore().lostFound;
  },

  addLostFound(payload: {
    roomNumber: string;
    itemName: string;
    description?: string;
  }): LostFoundRecord {
    const store = getHousekeepingStore();
    const record: LostFoundRecord = {
      id: makeId('lf'),
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      ...payload
    };

    store.lostFound.unshift(record);
    saveHousekeepingStore(store);
    pushAudit({ action: 'CREATE', entity: 'LOST_FOUND', entityId: record.id, details: payload });
    return record;
  },

  updateLostFoundStatus(recordId: string, status: LostFoundRecord['status']): LostFoundRecord | null {
    const store = getHousekeepingStore();
    const index = store.lostFound.findIndex((record) => record.id === recordId);
    if (index === -1) {
      return null;
    }

    store.lostFound[index] = {
      ...store.lostFound[index],
      status
    };
    saveHousekeepingStore(store);
    pushAudit({ action: 'UPDATE', entity: 'LOST_FOUND', entityId: recordId, details: { status } });
    return store.lostFound[index];
  }
};

export interface SettingUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  userCode?: string | null;
  lastLoginAt?: string;
}

export interface SettingRoleRecord {
  id: string;
  name: string;
  permissions: string[];
}

export interface BusinessProfileRecord {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  timezone: string;
  currency: string;
}

interface SettingsStore {
  businessProfile: BusinessProfileRecord;
  users: SettingUserRecord[];
  roles: SettingRoleRecord[];
  tax: {
    vatRate: number;
    whtRates: Record<string, number>;
  };
  paymentGateways: {
    paystack: { enabled: boolean; publicKey: string; secretKey: string };
    flutterwave: { enabled: boolean; publicKey: string; secretKey: string };
    interswitch: { enabled: boolean; merchantCode: string; terminalId: string };
  };
  backups: Array<{
    id: string;
    createdAt: string;
    createdBy: string;
    notes?: string;
  }>;
}

const defaultSettingsStore = (): SettingsStore => {
  const user = useAuthStore.getState().user;
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.name || 'System Admin';

  return {
    businessProfile: {
      name: user?.hotelName || 'HotelOpX Property',
      email: user?.email || 'ops@hotelopx.ng',
      phone: '+2348000000000',
      address: 'Lagos, Nigeria',
      timezone: 'Africa/Lagos',
      currency: 'NGN'
    },
    users: user
      ? [
          {
            id: user.id,
            name: fullName,
            email: user.email,
            role: user.role,
            isActive: true
          }
        ]
      : [],
    roles: [
      { id: 'role-business-admin', name: 'BUSINESS_ADMIN', permissions: ['*'] },
      { id: 'role-manager', name: 'MANAGER', permissions: ['reception:*', 'pos:*', 'housekeeping:*', 'accounting:*', 'reports:view'] },
      { id: 'role-manager-reception', name: 'MANAGER_RECEPTION', permissions: ['reception:*', 'reports:view'] },
      { id: 'role-manager-pos', name: 'MANAGER_POS', permissions: ['pos:*', 'reports:view'] },
      { id: 'role-manager-housekeeping', name: 'MANAGER_HOUSEKEEPING', permissions: ['housekeeping:*', 'reports:view'] },
      { id: 'role-manager-accounting', name: 'MANAGER_ACCOUNTING', permissions: ['accounting:*', 'reports:view'] },
      { id: 'role-reception', name: 'RECEPTION', permissions: ['reservations:read', 'reservations:write'] },
      { id: 'role-accounting', name: 'ACCOUNTANT', permissions: ['accounting:*'] },
      { id: 'role-housekeeping', name: 'HOUSEKEEPING', permissions: ['rooms:status:update'] },
      { id: 'role-pos', name: 'POS_STAFF', permissions: ['pos:*'] }
    ],
    tax: {
      vatRate: 7.5,
      whtRates: {
        rent: 5,
        consultancy: 10,
        contracts: 5,
        dividends: 10
      }
    },
    paymentGateways: {
      paystack: { enabled: true, publicKey: '', secretKey: '' },
      flutterwave: { enabled: true, publicKey: '', secretKey: '' },
      interswitch: { enabled: false, merchantCode: '', terminalId: '' }
    },
    backups: []
  };
};

const getSettingsStore = (): SettingsStore => getStore<SettingsStore>(SETTINGS_KEY, defaultSettingsStore());
const saveSettingsStore = (store: SettingsStore) => setStore(SETTINGS_KEY, store);

export const settingsOpsService = {
  getBusinessProfile(): BusinessProfileRecord {
    return getSettingsStore().businessProfile;
  },

  updateBusinessProfile(payload: Partial<BusinessProfileRecord>): BusinessProfileRecord {
    const store = getSettingsStore();
    store.businessProfile = {
      ...store.businessProfile,
      ...payload
    };

    saveSettingsStore(store);
    pushAudit({ action: 'UPDATE', entity: 'BUSINESS_PROFILE', entityId: 'business-profile', details: payload });
    return store.businessProfile;
  },

  async listUsers(): Promise<SettingUserRecord[]> {
    if (!isDemoMode()) {
      try {
        const store = getSettingsStore();
        const response = await api.get('/users');
        const users = toArray<Record<string, unknown>>(response.data).map((row) => {
          const firstName = String(row.firstName || '').trim();
          const lastName = String(row.lastName || '').trim();
          const currentUser = store.users.find((entry) => entry.id === String(row.id));
          const backendRole = String(row.role || 'RECEPTION');
          const role =
            backendRole === 'MANAGER' && currentUser?.role.startsWith('MANAGER_')
              ? currentUser.role
              : backendRole;
          return {
            id: String(row.id),
            name: `${firstName} ${lastName}`.trim() || String(row.name || 'User'),
            email: String(row.email || ''),
            role,
            isActive: row.isActive !== false,
            userCode: row.userCode ? String(row.userCode) : null,
            lastLoginAt: typeof row.lastLoginAt === 'string' ? row.lastLoginAt : undefined
          };
        });

        store.users = users;
        saveSettingsStore(store);
        return users;
      } catch (_error) {
        // Fall back to local cache.
      }
    }

    return getSettingsStore().users;
  },

  async createUser(payload: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    password: string;
  }): Promise<SettingUserRecord> {
    const store = getSettingsStore();
    const currentUser = useAuthStore.getState().user;
    let userId = makeId('user');
    let userRole = payload.role;
    let isActive = true;

    if (!isDemoMode() && currentUser?.hotelId) {
      try {
        const response = await api.post('/users', {
          email: payload.email,
          password: payload.password,
          firstName: payload.firstName,
          lastName: payload.lastName,
          role: payload.role,
          hotelId: currentUser.hotelId
        });

        const created = response.data as { id?: string; role?: string; isActive?: boolean };
        userId = String(created.id || userId);
        userRole = String(created.role || userRole);
        if (userRole === 'MANAGER' && payload.role.startsWith('MANAGER_')) {
          userRole = payload.role;
        }
        isActive = created.isActive !== false;
      } catch (_error) {
        // Keep local creation when backend endpoint is unavailable (demo/offline mode).
      }
    }

    const user: SettingUserRecord = {
      id: userId,
      name: `${payload.firstName} ${payload.lastName}`.trim(),
      email: payload.email,
      role: userRole,
      isActive
    };

    const existingIndex = store.users.findIndex((entry) => entry.id === user.id);
    if (existingIndex >= 0) {
      store.users[existingIndex] = user;
    } else {
      store.users.unshift(user);
    }
    saveSettingsStore(store);
    pushAudit({ action: 'CREATE', entity: 'USER', entityId: user.id, details: { email: user.email, role: user.role } });
    return user;
  },

  async toggleUserActive(userId: string): Promise<SettingUserRecord | null> {
    const store = getSettingsStore();
    const index = store.users.findIndex((user) => user.id === userId);
    if (index === -1) {
      return null;
    }

    const current = store.users[index];
    let updated: SettingUserRecord = {
      ...current,
      isActive: !current.isActive
    };

    if (!isDemoMode()) {
      try {
        const response = current.isActive
          ? await api.patch(`/users/${userId}/deactivate`)
          : await api.put(`/users/${userId}`, { isActive: true });

        const row = response.data as Record<string, unknown>;
        const firstName = String(row.firstName || '').trim();
        const lastName = String(row.lastName || '').trim();
        updated = {
          id: String(row.id || userId),
          name: `${firstName} ${lastName}`.trim() || current.name,
          email: String(row.email || current.email),
          role: row.role === 'MANAGER' && current.role.startsWith('MANAGER_')
            ? current.role
            : String(row.role || current.role),
          isActive: row.isActive !== false,
          lastLoginAt: typeof row.lastLoginAt === 'string' ? row.lastLoginAt : current.lastLoginAt
        };
      } catch (_error) {
        // Fall back to local toggle state.
      }
    }

    store.users[index] = updated;
    saveSettingsStore(store);
    pushAudit({ action: 'TOGGLE_ACTIVE', entity: 'USER', entityId: userId, details: { isActive: updated.isActive } });
    return updated;
  },

  async assignUserCode(userId: string): Promise<{ userCode: string }> {
    if (!isDemoMode()) {
      const response = await api.post(`/users/${userId}/usercode`);
      const userCode = String((response.data as { userCode?: string })?.userCode || '');

      const store = getSettingsStore();
      const idx = store.users.findIndex((u) => u.id === userId);
      if (idx >= 0) {
        store.users[idx] = { ...store.users[idx], userCode };
        saveSettingsStore(store);
      }

      pushAudit({ action: 'USERCODE_ASSIGN', entity: 'USER', entityId: userId, details: {} });
      return { userCode };
    }

    // Demo mode — generate a local placeholder code so the UI flow still works.
    const userCode = String(Math.floor(10000 + Math.random() * 90000));
    const store = getSettingsStore();
    const idx = store.users.findIndex((u) => u.id === userId);
    if (idx >= 0) {
      store.users[idx] = { ...store.users[idx], userCode };
      saveSettingsStore(store);
    }
    pushAudit({ action: 'USERCODE_ASSIGN', entity: 'USER', entityId: userId, details: { demo: true } });
    return { userCode };
  },

  async listRoles(): Promise<SettingRoleRecord[]> {
    if (!isDemoMode()) {
      try {
        const response = await api.get('/roles');
        const roles = toArray<Record<string, unknown>>(response.data).map((row) => {
          const backendRole = String(row.role || row.name || 'RECEPTION').toUpperCase();
          const normalizedName = backendRole === 'RECEPTION' ? 'RECEPTION' : backendRole;
          return {
            id: `role-${normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            name: normalizedName,
            permissions: Array.isArray(row.permissions)
              ? row.permissions.filter((perm): perm is string => typeof perm === 'string')
              : []
          };
        });

        const store = getSettingsStore();
        store.roles = roles;
        saveSettingsStore(store);
        return roles;
      } catch (_error) {
        // Fall back to local role definitions.
      }
    }

    return getSettingsStore().roles;
  },

  updateRole(roleId: string, permissions: string[]): SettingRoleRecord | null {
    const store = getSettingsStore();
    const index = store.roles.findIndex((role) => role.id === roleId);
    if (index === -1) {
      return null;
    }

    store.roles[index] = {
      ...store.roles[index],
      permissions
    };

    saveSettingsStore(store);
    pushAudit({ action: 'UPDATE', entity: 'ROLE', entityId: roleId, details: { permissions } });
    return store.roles[index];
  },

  getTaxSettings(): SettingsStore['tax'] {
    return getSettingsStore().tax;
  },

  updateTaxSettings(payload: Partial<SettingsStore['tax']>): SettingsStore['tax'] {
    const store = getSettingsStore();
    store.tax = {
      ...store.tax,
      ...payload,
      whtRates: {
        ...store.tax.whtRates,
        ...(payload.whtRates || {})
      }
    };

    saveSettingsStore(store);
    pushAudit({ action: 'UPDATE', entity: 'TAX_SETTINGS', entityId: 'tax', details: payload });
    return store.tax;
  },

  getPaymentGateways(): SettingsStore['paymentGateways'] {
    return getSettingsStore().paymentGateways;
  },

  updatePaymentGateway<K extends keyof SettingsStore['paymentGateways']>(
    gateway: K,
    payload: Partial<SettingsStore['paymentGateways'][K]>
  ): SettingsStore['paymentGateways'] {
    const store = getSettingsStore();
    store.paymentGateways[gateway] = {
      ...store.paymentGateways[gateway],
      ...payload
    } as SettingsStore['paymentGateways'][K];

    saveSettingsStore(store);
    pushAudit({ action: 'UPDATE', entity: 'PAYMENT_GATEWAY', entityId: gateway, details: payload });
    return store.paymentGateways;
  },

  listBackups(): SettingsStore['backups'] {
    return getSettingsStore().backups;
  },

  createBackup(notes?: string): SettingsStore['backups'][number] {
    const store = getSettingsStore();
    const user = useAuthStore.getState().user;
    const backup = {
      id: makeId('backup'),
      createdAt: new Date().toISOString(),
      createdBy: user?.email || 'system@hotelopx.ng',
      notes
    };

    store.backups.unshift(backup);
    saveSettingsStore(store);
    pushAudit({ action: 'CREATE', entity: 'BACKUP', entityId: backup.id, details: { notes } });
    return backup;
  }
};

export interface AuditRecord {
  id: string;
  timestamp: string;
  action: string;
  entity: string;
  entityId: string;
  details: Record<string, unknown>;
}

export const auditOpsService = {
  async list(): Promise<AuditRecord[]> {
    if (!isDemoMode()) {
      try {
        const response = await api.get('/audit/logs');
        return toArray<Record<string, unknown>>(response.data).map((row) => ({
          id: String(row.id || makeId('audit')),
          timestamp: String(row.createdAt || row.timestamp || new Date().toISOString()),
          action: String(row.action || 'UNKNOWN'),
          entity: String(row.entity || 'UNKNOWN'),
          entityId: String(row.entityId || ''),
          details: (row.changes as Record<string, unknown>) || {}
        }));
      } catch (_error) {
        // Fall back to local audit cache.
      }
    }

    return getStore<AuditRecord[]>(AUDIT_KEY, []);
  }
};
