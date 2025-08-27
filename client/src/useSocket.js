
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { API } from './api';

export function useSocket(token, onAttach){
  const ref = useRef(null);
  useEffect(()=>{
    if(!token) return;
    const s = io(API, { auth: { token } });
    ref.current = s;
    if (onAttach) onAttach(s);
    return ()=> s.close();
  },[token]);
  return ref;
}
