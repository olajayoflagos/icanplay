import React,{useEffect,useRef,useState} from 'react';

const RTC_CFG = { iceServers: [{ urls:'stun:stun.l.google.com:19302' }] };

export default function VoicePanel({ socket, match, meIsPlayer }){
  const [enabled,setEnabled] = useState(false);
  const [status,setStatus] = useState('idle');
  const pcRef = useRef(null);
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(()=>{
    if(!socket || !match?.id) return;
    if(!meIsPlayer) return; // spectators do not use voice
    const onOffer = async ({ matchId, sdp, from })=>{
      if(matchId!==match.id) return;
      await ensurePC();
      await pcRef.current.setRemoteDescription(sdp);
      const ans = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(ans);
      socket.emit('rtc:answer', { matchId: match.id, sdp: ans });
    };
    const onAnswer = async ({ matchId, sdp })=>{
      if(matchId!==match.id) return;
      await pcRef.current?.setRemoteDescription(sdp);
    };
    const onCand = async ({ matchId, cand })=>{
      if(matchId!==match.id || !pcRef.current) return;
      try{ await pcRef.current.addIceCandidate(cand); }catch{}
    };
    const onEnd = ({ matchId })=>{
      if(matchId!==match.id) return;
      teardown();
    };

    socket.on('rtc:offer', onOffer);
    socket.on('rtc:answer', onAnswer);
    socket.on('rtc:candidate', onCand);
    socket.on('rtc:end', onEnd);
    return ()=>{ socket.off('rtc:offer', onOffer); socket.off('rtc:answer', onAnswer); socket.off('rtc:candidate', onCand); socket.off('rtc:end', onEnd); }
  },[socket, match?.id, meIsPlayer]);

  async function ensurePC(){
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CFG);
    pc.onicecandidate = (e)=>{ if(e.candidate) socket.emit('rtc:candidate', { matchId: match.id, cand: e.candidate }); };
    pc.onconnectionstatechange = ()=> setStatus(pc.connectionState);
    pc.ontrack = (e)=>{ remoteRef.current.srcObject = e.streams[0]; };
    pcRef.current = pc;
    return pc;
  }

  async function start(){
    if(!meIsPlayer) return;
    const pc = await ensurePC();
    const stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
    streamRef.current = stream;
    localRef.current.srcObject = stream;
    stream.getTracks().forEach(t=> pc.addTrack(t, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('rtc:offer', { matchId: match.id, sdp: offer });
    setEnabled(true);
    setStatus('connecting');
  }

  function mute(toggle){
    streamRef.current?.getAudioTracks().forEach(t=> t.enabled = !toggle);
  }

  function teardown(){
    setEnabled(false);
    setStatus('idle');
    if (pcRef.current){ pcRef.current.close(); pcRef.current=null; }
    streamRef.current?.getTracks().forEach(t=>t.stop());
    streamRef.current=null;
    socket.emit('rtc:end', { matchId: match.id });
  }

  return <div className='rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-2'>
    <div className='text-sm opacity-70'>Voice (players only) • {status}</div>
    {!enabled
      ? <button onClick={start} disabled={!meIsPlayer} className={'px-3 py-1 rounded '+(meIsPlayer?'bg-emerald-600 hover:bg-emerald-700':'bg-gray-700 cursor-not-allowed')}>Join Voice</button>
      : <div className='flex gap-2'>
          <button onClick={()=>mute(true)} className='px-2 py-1 rounded bg-gray-800'>Mute</button>
          <button onClick={()=>mute(false)} className='px-2 py-1 rounded bg-gray-800'>Unmute</button>
          <button onClick={teardown} className='px-2 py-1 rounded bg-red-600'>Leave</button>
        </div>
    }
    <div className='flex gap-2 text-xs opacity-60'>
      <audio ref={localRef} autoPlay muted></audio>
      <audio ref={remoteRef} autoPlay></audio>
    </div>
  </div>
}
