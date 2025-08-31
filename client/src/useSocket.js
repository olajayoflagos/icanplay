import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from './api';

export function useSocket(token, onReady) {
  const ref = useRef(null);

  useEffect(() => {
    if (!token) return;
    const s = io(API_BASE, { transports: ['websocket'], auth: { token }, autoConnect: true });
    ref.current = s;
    s.on('connect', () => onReady?.(s));
    return () => {
      try { s.disconnect(); } catch {}
      ref.current = null;
    };
  }, [token]);

  return ref;
}
