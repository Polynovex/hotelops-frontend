/**
 * Desktop bridge — detects Electron and exposes a unified API.
 * In the browser every method is a no-op / returns sensible defaults.
 */

export interface FileSaveOptions {
  defaultName: string;
  buffer: ArrayBuffer | Uint8Array;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface FileReadOptions {
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface FileReadResult {
  name: string;
  mimeType: string;
  /** Base64-encoded file content */
  data: string;
  size: number;
}

export interface NotifyOptions {
  title?: string;
  body?: string;
  urgency?: 'low' | 'normal' | 'critical';
}

export interface SyncStatus {
  online: boolean;
  pending: number;
}

export interface QueuedOp {
  resource: string;
  method: string;
  payload?: unknown;
  clientId?: string;
}

export interface DesktopBridge {
  platform: string;
  version: string;

  // Config
  getConfig: (key: string) => Promise<unknown>;
  setConfig: (key: string, value: unknown) => Promise<void>;
  getApiUrl: () => Promise<string>;
  getWsUrl: () => Promise<string>;

  // Auth
  setAuthToken: (token: string | null) => Promise<void>;

  // Offline queue & cache
  queue: (op: QueuedOp) => Promise<{ id: string }>;
  read: (table: string, query?: Record<string, unknown>) => Promise<unknown[]>;
  write: (table: string, record: Record<string, unknown>) => Promise<{ id: string }>;
  delete: (table: string, id: string) => Promise<{ deleted: boolean }>;
  syncNow: () => Promise<{ synced: number; pending: number; online: boolean }>;
  status: () => Promise<SyncStatus>;
  pendingCount: () => Promise<number>;
  clearSynced: () => Promise<{ deleted: number }>;

  // File operations
  saveFile: (opts: FileSaveOptions) => Promise<{ saved: boolean; filePath?: string }>;
  readFile: (opts?: FileReadOptions) => Promise<FileReadResult | null>;

  // Print
  printReceipt: (html: string) => Promise<boolean>;

  // Notifications
  notify: (opts: NotifyOptions) => Promise<boolean>;

  // App helpers
  reload: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  installUpdate: () => Promise<void>;

  // Event subscriptions
  onSyncStatus: (cb: (s: SyncStatus) => void) => () => void;
  onUpdateAvailable: (cb: () => void) => () => void;
  onUpdateReady: (cb: () => void) => () => void;
}

declare global {
  interface Window {
    hotelopsxDesktop?: DesktopBridge;
  }
}

export const desktopBridge: DesktopBridge | null =
  typeof window !== 'undefined' && window.hotelopsxDesktop
    ? window.hotelopsxDesktop
    : null;

export const isDesktop = !!desktopBridge;

export const syncAuthTokenToDesktop = async (token: string | null): Promise<void> => {
  if (desktopBridge) {
    await desktopBridge.setAuthToken(token);
  }
};

/**
 * Download a file:
 * - Desktop: triggers native save dialog
 * - Browser: creates a temporary anchor and clicks it
 */
export const downloadFile = async (
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
  mimeType = 'application/octet-stream'
): Promise<void> => {
  if (desktopBridge) {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    const filters =
      ext === 'xlsx'
        ? [{ name: 'Excel', extensions: ['xlsx'] }]
        : ext === 'csv'
          ? [{ name: 'CSV', extensions: ['csv'] }]
          : [{ name: 'All Files', extensions: ['*'] }];

    await desktopBridge.saveFile({ defaultName: fileName, buffer, filters });
    return;
  }

  // Browser fallback
  const bytes: BlobPart =
    buffer instanceof Uint8Array
      ? new Uint8Array(buffer).buffer as ArrayBuffer
      : buffer as ArrayBuffer;
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Pick a file for upload:
 * - Desktop: uses native file dialog (no browser sandbox limitation)
 * - Browser: returns null (caller should use <input type="file">)
 */
export const pickFileForUpload = async (
  opts?: FileReadOptions
): Promise<FileReadResult | null> => {
  if (desktopBridge) {
    return desktopBridge.readFile(opts);
  }
  return null;
};
