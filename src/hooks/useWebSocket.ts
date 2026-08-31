import { useCallback, useEffect } from 'react';
import { websocketService } from '../api/websocket';
import { useAuthStore } from '../store/authStore';

/**
 * Shared WebSocket access.
 *
 * Two properties matter here, and both were previously wrong:
 *
 * 1. `on` MUST be referentially stable. It was `websocketService.on.bind(...)`,
 *    which produced a new function every render, so every consumer with `[on]`
 *    in a dependency array tore down and re-established its subscriptions on
 *    each render — and on a page whose load() sets state, that churns
 *    continuously.
 *
 * 2. The socket is a singleton shared by every consumer, so an individual
 *    component unmounting must NOT disconnect it. It previously did, meaning
 *    navigating away from any one page killed realtime for the whole app.
 *    A reference count closes the socket only when the last consumer leaves.
 */

let consumers = 0;

export const useWebSocket = () => {
  const hotelId = useAuthStore((state) => state.user?.hotelId);

  useEffect(() => {
    if (!hotelId) {
      return;
    }

    consumers += 1;
    websocketService.connect();

    return () => {
      consumers -= 1;
      // Only the last component to unmount closes the shared connection.
      if (consumers <= 0) {
        consumers = 0;
        websocketService.disconnect();
      }
    };
  }, [hotelId]);

  // Stable across renders: websocketService is a module singleton, so there is
  // nothing to depend on.
  const on = useCallback(
    <T = unknown>(eventName: string, handler: (payload: T) => void) =>
      websocketService.on(eventName, handler),
    []
  );

  const disconnect = useCallback(() => websocketService.disconnect(), []);

  return { on, disconnect };
};
