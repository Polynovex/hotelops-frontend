import { bookingService, roomService } from '../services/api';

export const pmsApi = {
  getReservations: bookingService.getAll,
  getRooms: roomService.getAll
};
