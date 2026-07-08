import { posService } from '../services/api';

export const posApi = {
  getOutlets: posService.getOutlets,
  createOutlet: posService.createOutlet,
  getOrders: posService.getOrders,
  createOrder: posService.createOrder,
  sendToKds: posService.sendToKds,
  completeOrder: posService.completeOrder,
  voidOrder: posService.voidOrder,
  getKdsOrders: posService.getKdsOrders,
  acknowledgeKdsOrder: posService.acknowledgeKdsOrder,
  bulkSyncOrders: posService.bulkSyncOrders,
  getPendingSync: posService.getPendingSync,
  acknowledgeSync: posService.acknowledgeSync
};
