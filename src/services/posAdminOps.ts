export interface PosMenuItemRecord {
  id: string;
  outletId: string;
  sku: string;
  name: string;
  category: string;
  kitchenStation: string;
  price: number;
  cost?: number;
  isActive: boolean;
  isAvailable: boolean;
  createdAt: string;
}

export interface PosCategoryRecord {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PosKitchenStationRecord {
  id: string;
  name: string;
  displayOrder: number;
}

export interface PosTableRecord {
  id: string;
  tableNumber: string;
  floor: string;
  seats: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'OUT_OF_SERVICE';
}

const MENU_KEY = 'hotelopx.v3.pos.menu';
const CATEGORY_KEY = 'hotelopx.v3.pos.categories';
const STATION_KEY = 'hotelopx.v3.pos.stations';
const TABLE_KEY = 'hotelopx.v3.pos.tables';

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

const readStore = <T>(key: string, fallback: T): T => safeParse<T>(localStorage.getItem(key), fallback);
const writeStore = <T>(key: string, value: T) => localStorage.setItem(key, JSON.stringify(value));

const defaultCategories: PosCategoryRecord[] = [
  { id: makeId('cat'), name: 'Appetizers', sortOrder: 1 },
  { id: makeId('cat'), name: 'Mains', sortOrder: 2 },
  { id: makeId('cat'), name: 'Desserts', sortOrder: 3 },
  { id: makeId('cat'), name: 'Drinks', sortOrder: 4 }
];

const defaultStations: PosKitchenStationRecord[] = [
  { id: makeId('station'), name: 'Grill', displayOrder: 1 },
  { id: makeId('station'), name: 'Fry', displayOrder: 2 },
  { id: makeId('station'), name: 'Cold', displayOrder: 3 },
  { id: makeId('station'), name: 'Bar', displayOrder: 4 }
];

const defaultTables: PosTableRecord[] = Array.from({ length: 12 }).map((_, index) => ({
  id: makeId('table'),
  tableNumber: `T${index + 1}`,
  floor: index < 8 ? 'Main Hall' : 'Terrace',
  seats: index % 2 === 0 ? 4 : 2,
  status: 'AVAILABLE'
}));

export const posAdminOpsService = {
  listCategories(): PosCategoryRecord[] {
    return readStore<PosCategoryRecord[]>(CATEGORY_KEY, defaultCategories).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  createCategory(name: string): PosCategoryRecord {
    const rows = this.listCategories();
    const created: PosCategoryRecord = {
      id: makeId('cat'),
      name,
      sortOrder: rows.length + 1
    };

    rows.push(created);
    writeStore(CATEGORY_KEY, rows);
    return created;
  },

  listKitchenStations(): PosKitchenStationRecord[] {
    return readStore<PosKitchenStationRecord[]>(STATION_KEY, defaultStations).sort((a, b) => a.displayOrder - b.displayOrder);
  },

  createKitchenStation(name: string): PosKitchenStationRecord {
    const rows = this.listKitchenStations();
    const created: PosKitchenStationRecord = {
      id: makeId('station'),
      name,
      displayOrder: rows.length + 1
    };

    rows.push(created);
    writeStore(STATION_KEY, rows);
    return created;
  },

  listMenuItems(): PosMenuItemRecord[] {
    return readStore<PosMenuItemRecord[]>(MENU_KEY, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createMenuItem(payload: Omit<PosMenuItemRecord, 'id' | 'createdAt'>): PosMenuItemRecord {
    const rows = this.listMenuItems();
    const created: PosMenuItemRecord = {
      ...payload,
      id: makeId('menu'),
      createdAt: new Date().toISOString()
    };

    rows.unshift(created);
    writeStore(MENU_KEY, rows);
    return created;
  },

  updateMenuItem(itemId: string, updates: Partial<Omit<PosMenuItemRecord, 'id'>>): PosMenuItemRecord | null {
    const rows = this.listMenuItems();
    const index = rows.findIndex((row) => row.id === itemId);
    if (index === -1) {
      return null;
    }

    rows[index] = {
      ...rows[index],
      ...updates
    };
    writeStore(MENU_KEY, rows);
    return rows[index];
  },

  deleteMenuItem(itemId: string): void {
    const rows = this.listMenuItems().filter((row) => row.id !== itemId);
    writeStore(MENU_KEY, rows);
  },

  listTables(): PosTableRecord[] {
    return readStore<PosTableRecord[]>(TABLE_KEY, defaultTables).sort((a, b) => a.tableNumber.localeCompare(b.tableNumber));
  },

  updateTableStatus(tableId: string, status: PosTableRecord['status']): PosTableRecord | null {
    const rows = this.listTables();
    const index = rows.findIndex((row) => row.id === tableId);
    if (index === -1) {
      return null;
    }

    rows[index] = {
      ...rows[index],
      status
    };

    writeStore(TABLE_KEY, rows);
    return rows[index];
  }
};
