// client/src/connectSocket.js
import { io } from 'socket.io-client';
import { API } from './api';   // use the same export everywhere

export function connectSocket(token) {
  return io(API, {
    transports: ['websocket'],   // force WebSocket for Render/Vercel
    autoConnect: true,
    auth: { token }
  });
}
