// client/src/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API } from './api';

export function useSocket(token, onAttach){
  const ref = useRef(null);

  useEffect(() => {
    if (!token) return;

    // Ensure we use websocket transport for stability
    const s = io(API, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true
    });

    ref.current = s;

    s.on('connect', () => {
      if (onAttach) onAttach(s);
    });

    return () => {
      try { s.disconnect(); } catch {}
      ref.current = null;
    };
  }, [token]);

  return ref;
}
