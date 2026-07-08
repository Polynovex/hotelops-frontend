import { useEffect } from 'react';
import { websocketService } from '../api/websocket';
import { useAuthStore } from '../store/authStore';

export const useWebSocket = () => {
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user?.hotelId) {
      return;
    }

    websocketService.connect();

    return () => {
      websocketService.disconnect();
    };
  }, [user?.hotelId]);

  return {
    on: websocketService.on.bind(websocketService),
    disconnect: websocketService.disconnect.bind(websocketService)
  };
};
