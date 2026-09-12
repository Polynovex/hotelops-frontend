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

export interface TemplateInfo {
  entity: MigrationEntity;
  fields: number;
  requiredFields: string[];
  csv: string;
  xlsx: string;
}

/**
 * Downloads a template through the API client rather than by pointing the
 * browser at the URL.
 *
 * The route is authenticated, and a plain `<a href>` or `window.open` sends no
 * Authorization header — so the download would 401 for everyone. Fetching as a
 * blob and clicking a synthetic link keeps the token on the request.
 */
export const downloadMigrationTemplate = async (
  entity: MigrationEntity,
  format: 'csv' | 'xlsx'
): Promise<void> => {
  const response = await api.get(`/admin/migration/template/${entity}`, {
    params: { format },
    responseType: 'blob'
  });

  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `hotelopx-${entity.toLowerCase()}-import-template.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Released on the next tick; revoking synchronously can cancel the download
  // in Safari before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const listMigrationTemplates = async (): Promise<TemplateInfo[]> => {
  const { data } = await api.get('/admin/migration/templates');
  return data;
};

export interface PreflightResult {
  ok: boolean;
  fileName: string;
  rowCount: number;
  columns: string[];
  /** Required target fields with no column that could supply them. */
  missingRequired: string[];
  /** Columns in the file that the importer will ignore. */
  unrecognised: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Checks a file before anything is uploaded.
 *
 * Worth doing in the browser even though the server validates too. The server
 * round-trip for a 20,000-row export is slow and the common mistakes — wrong
 * file type, the template's own example rows left in, a header row that was
 * renamed — are all visible locally and immediately. Catching them here means
 * the operator fixes the file rather than waiting to be told.
 */
export const preflightFile = (
  file: File,
  schema: TargetField[]
): Promise<PreflightResult> =>
  new Promise((resolve) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const result = (over: Partial<PreflightResult> = {}): PreflightResult => ({
      ok: errors.length === 0,
      fileName: file.name,
      rowCount: 0,
      columns: [],
      missingRequired: [],
      unrecognised: [],
      errors,
      warnings,
      ...over,
      // Recomputed last: `over` may have added errors of its own.
      ...(over.errors ? {} : {}),
    });

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'txt'].includes(extension)) {
      errors.push(
        extension === 'xlsx' || extension === 'xls'
          ? 'This is an Excel file. Save it as CSV first (File → Save As → CSV UTF-8), then upload that.'
          : `.${extension} files cannot be read. Upload a CSV.`
      );
      return resolve(result());
    }

    if (file.size === 0) {
      errors.push('The file is empty.');
      return resolve(result());
    }

    if (file.size > 25 * 1024 * 1024) {
      errors.push('The file is larger than 25 MB. Split it and import in parts.');
      return resolve(result());
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: ({ data, meta, errors: parseErrors }) => {
        const columns = (meta.fields ?? []).filter(Boolean);

        if (!columns.length) {
          errors.push('No header row was found. The first line must contain the column names.');
          return resolve(result({ rowCount: data.length }));
        }

        if (!data.length) {
          errors.push('The file has a header row but no data.');
          return resolve(result({ columns }));
        }

        /*
         * Papa reports a problem per malformed row, which for a badly quoted
         * file means thousands of identical complaints. Only the first few are
         * useful to a person.
         */
        if (parseErrors.length) {
          const shown = parseErrors.slice(0, 3).map((e) => `row ${(e.row ?? 0) + 2}: ${e.message}`);
          errors.push(
            `The file could not be read cleanly (${parseErrors.length} problem${parseErrors.length === 1 ? '' : 's'}). ${shown.join('; ')}`
          );
        }

        // Matching is case- and separator-insensitive, mirroring the server's
        // own alias matching so the two agree about what counts as present.
        const normalise = (value: string) => value.toLowerCase().replace(/[\s_-]/g, '');
        const present = new Set(columns.map(normalise));

        const missingRequired = schema
          .filter((f) => f.required)
          .filter((f) => !present.has(normalise(f.field)))
          .map((f) => `${f.label} (${f.field})`);

        const known = new Set(schema.map((f) => normalise(f.field)));
        const unrecognised = columns.filter((c) => !known.has(normalise(c)));

        if (missingRequired.length) {
          errors.push(`Required column${missingRequired.length === 1 ? '' : 's'} missing: ${missingRequired.join(', ')}`);
        }

        if (unrecognised.length) {
          warnings.push(
            `Not recognised by name and will need mapping in the next step: ${unrecognised.join(', ')}`
          );
        }

        // The template ships two example rows. Importing them creates two
        // fictional guests in a live property, which is a tedious thing to undo.
        const sampleLeftIn = data.some((row) =>
          Object.values(row).some((v) => typeof v === 'string' && /^(G-100[12]|R-20[12]|B-500[12])$/.test(v.trim()))
        );
        if (sampleLeftIn) {
          warnings.push('The template’s example rows are still in the file. Delete them before importing.');
        }

        resolve(result({ rowCount: data.length, columns, missingRequired, unrecognised }));
      },
      error: (err) => {
        errors.push(`The file could not be read: ${err.message}`);
        resolve(result());
      }
    });
  });
