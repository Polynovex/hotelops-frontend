import Papa from 'papaparse';
import { api } from './api';

/** Data import wizard (analyse → review → commit). */

export type MigrationEntity = 'GUEST' | 'ROOM' | 'BOOKING';

export interface TargetField {
  field: string;
  label: string;
  type: string;
  required: boolean;
  enumValues?: string[];
}

export interface RowIssue {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface AnalyseResult {
  jobId: string;
  business: { id: string; name: string };
  entity: MigrationEntity;
  mapping: Record<string, string>;
  sourceColumns: string[];
  unmappedColumns: string[];
  missingRequiredFields: string[];
  canCommit: boolean;
  summary: { total: number; valid: number; invalid: number };
  issues: RowIssue[];
  preview: Array<Record<string, unknown>>;
}

export interface CommitResult {
  jobId: string;
  status: string;
  imported: number;
  skippedInvalid: number;
  failed: number;
  failures: Array<{ row: number; message: string }>;
}

export interface MigrationJob {
  id: string;
  entity: MigrationEntity;
  status: string;
  sourceName: string | null;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  skippedRows: number;
  createdAt: string;
  committedAt: string | null;
}

/**
 * Parses a CSV file in the browser.
 *
 * Header rows are trimmed because exported spreadsheets very often carry
 * trailing spaces, which would otherwise break the column mapping for reasons
 * an admin cannot see.
 */
export const parseCsv = (file: File): Promise<Array<Record<string, unknown>>> =>
  new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        if (result.errors.length > 0 && result.data.length === 0) {
          reject(new Error(result.errors[0].message));
          return;
        }
        resolve(result.data);
      },
      error: (error) => reject(error)
    });
  });

export const migrationService = {
  async getSchema(entity: MigrationEntity): Promise<TargetField[]> {
    const { data } = await api.get(`/admin/migration/schema/${entity}`);
    return Array.isArray(data?.fields) ? data.fields : [];
  },

  async analyse(payload: {
    entity: MigrationEntity;
    rows: Array<Record<string, unknown>>;
    mapping?: Record<string, string>;
    sourceName?: string;
    sourceSystem?: string;
    hotelId?: string;
  }): Promise<AnalyseResult> {
    const { data } = await api.post('/admin/migration/analyse', payload);
    return data as AnalyseResult;
  },

  async commit(jobId: string, rows: Array<Record<string, unknown>>): Promise<CommitResult> {
    const { data } = await api.post(`/admin/migration/${jobId}/commit`, { rows, confirm: true });
    return data as CommitResult;
  },

  async listJobs(hotelId?: string): Promise<MigrationJob[]> {
    const { data } = await api.get('/admin/migration/jobs', {
      params: hotelId ? { hotelId } : undefined
    });
    return Array.isArray(data) ? data : [];
  }
};

export const ENTITY_LABEL: Record<MigrationEntity, string> = {
  GUEST: 'Guests',
  ROOM: 'Rooms',
  BOOKING: 'Bookings'
};

/**
 * Import order matters: a booking references a guest and a room, so those must
 * exist first. Surfaced in the UI rather than left for the admin to discover
 * through failed rows.
 */
export const ENTITY_ORDER: MigrationEntity[] = ['GUEST', 'ROOM', 'BOOKING'];
