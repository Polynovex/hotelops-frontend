import { api } from './api';

/** Housekeeping task workflow (Part 3). */

export type HousekeepingTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'APPROVED' | 'REJECTED';
export type HousekeepingPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface HousekeepingTask {
  id: string;
  room: { id: string; roomNumber: string; floor: number; roomType: string; status: string };
  status: HousekeepingTaskStatus;
  priority: HousekeepingPriority;
  notes: string | null;
  rejectionReason: string | null;
  assignedBy: string | null;
  assignedTo: Array<{ id: string; firstName: string; lastName: string }>;
  startedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirtyRoom {
  id: string;
  roomNumber: string;
  floor: number;
  roomType: string;
  updatedAt: string;
}

export interface Housekeeper {
  id: string;
  name: string;
  openTasks: number;
}

export interface HousekeepingNotification {
  id: string;
  type: 'ROOM_DIRTY' | 'TASK_ASSIGNED' | 'TASK_COMPLETED' | 'TASK_APPROVED' | 'TASK_REJECTED';
  message: string;
  taskId: string | null;
  roomId: string | null;
  isRead: boolean;
  createdAt: string;
}

const unwrap = <T>(value: unknown, fallback: T): T => (Array.isArray(value) ? (value as T) : fallback);

export const housekeepingService = {
  async listTasks(status?: HousekeepingTaskStatus): Promise<HousekeepingTask[]> {
    const { data } = await api.get('/housekeeping/tasks', { params: status ? { status } : undefined });
    return unwrap<HousekeepingTask[]>(data, []);
  },

  async listDirtyRooms(): Promise<DirtyRoom[]> {
    const { data } = await api.get('/housekeeping/rooms/dirty');
    return unwrap<DirtyRoom[]>(data, []);
  },

  async listHousekeepers(): Promise<Housekeeper[]> {
    const { data } = await api.get('/housekeeping/housekeepers');
    return unwrap<Housekeeper[]>(data, []);
  },

  async assignTask(payload: {
    roomId: string;
    assignedTo: string[];
    priority?: HousekeepingPriority;
    notes?: string;
  }): Promise<HousekeepingTask> {
    const { data } = await api.post('/housekeeping/tasks', payload);
    return data as HousekeepingTask;
  },

  async startTask(id: string): Promise<HousekeepingTask> {
    const { data } = await api.put(`/housekeeping/tasks/${id}/start`);
    return data as HousekeepingTask;
  },

  async completeTask(id: string): Promise<HousekeepingTask> {
    const { data } = await api.put(`/housekeeping/tasks/${id}/done`);
    return data as HousekeepingTask;
  },

  async approveTask(id: string): Promise<HousekeepingTask> {
    const { data } = await api.put(`/housekeeping/tasks/${id}/approve`);
    return data as HousekeepingTask;
  },

  async rejectTask(id: string, rejectionReason: string): Promise<HousekeepingTask> {
    const { data } = await api.put(`/housekeeping/tasks/${id}/reject`, { rejectionReason });
    return data as HousekeepingTask;
  },

  async listNotifications(): Promise<{ notifications: HousekeepingNotification[]; unreadCount: number }> {
    const { data } = await api.get('/housekeeping/notifications');
    return {
      notifications: unwrap<HousekeepingNotification[]>(data?.notifications, []),
      unreadCount: Number(data?.unreadCount || 0)
    };
  },

  async markRead(id: string) {
    await api.put(`/housekeeping/notifications/${id}/read`);
  },

  async markAllRead() {
    await api.put('/housekeeping/notifications/read-all');
  }
};

/** Shared status → MUI colour mapping so both dashboards agree. */
export const TASK_STATUS_COLOR: Record<
  HousekeepingTaskStatus,
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  PENDING: 'default',
  IN_PROGRESS: 'info',
  DONE: 'warning',
  APPROVED: 'success',
  REJECTED: 'error'
};

export const TASK_STATUS_LABEL: Record<HousekeepingTaskStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  DONE: 'Awaiting approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected — redo'
};

export const PRIORITY_COLOR: Record<HousekeepingPriority, 'default' | 'info' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'error'
};
