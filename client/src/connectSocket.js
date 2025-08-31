import { io } from 'socket.io-client';
import { API_BASE } from './api';

export function connectSocket(token) {
  return io(API_BASE, {
    transports: ['websocket'], // force WebSocket for Render/Vercel
    autoConnect: true,
    auth: { token }
  });
}
