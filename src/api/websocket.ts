import { useAuthStore } from '../store/authStore';

type EventHandler<T = unknown> = (payload: T) => void;
type WebSocketMessage<T = unknown> = { type?: string; payload?: T };

class WebSocketService {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();

  connect() {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      return;
    }

    const base = import.meta.env.VITE_WS_URL;
    if (!base) {
      // WebSocket disabled — serverless backend does not support persistent connections
      return;
    }

    const token = useAuthStore.getState().token;
    if (!token) {
      return;
    }

    const url = new URL(base);
    url.searchParams.set('token', token);

    this.socket = new WebSocket(url.toString());

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data || '{}')) as WebSocketMessage;
        if (!message.type) {
          return;
        }

        const listeners = this.handlers.get(message.type);
        if (!listeners) {
          return;
        }

        listeners.forEach((listener) => listener(message.payload));
      } catch (_error) {
        // Ignore malformed websocket payloads.
      }
    };

    this.socket.onclose = () => {
      this.socket = null;
    };
  }

  on<T = unknown>(eventName: string, handler: EventHandler<T>) {
    const existing = this.handlers.get(eventName) || new Set<EventHandler>();
    existing.add(handler as EventHandler);
    this.handlers.set(eventName, existing);

    return () => {
      const listeners = this.handlers.get(eventName);
      listeners?.delete(handler as EventHandler);
      if (listeners && listeners.size === 0) {
        this.handlers.delete(eventName);
      }
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }
}

export const websocketService = new WebSocketService();
