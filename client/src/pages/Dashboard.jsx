// client/src/pages/Dashboard.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Wallet from '../components/Wallet.jsx';
import CreateMatch from '../components/CreateMatch.jsx';
import JoinMatch from '../components/JoinMatch.jsx';

export default function Dashboard({ token, onBalance, socket, onCreated, onJoined }){
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto px-3 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* left column */}
        <div className="space-y-4">
          <section className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow">
            <h3 className="font-semibold mb-2">Wallet</h3>
            <Wallet token={token} onBalance={onBalance} />
          </section>

          <section className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow">
            <h3 className="font-semibold mb-2">Create Match</h3>
            <CreateMatch
              token={token}
              onCreated={(m)=>{
                onCreated?.(m);
                navigate('/arena', { state: { focusMatchId: m.id, started: true }});
              }}
            />
          </section>
        </div>

        {/* right column */}
        <div className="space-y-4">
          <section className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow">
            <h3 className="font-semibold mb-2">Join Match</h3>
            <JoinMatch
              token={token}
              onJoined={(m)=>{
                onJoined?.(m);
                navigate('/arena', { state: { focusMatchId: m.id, started: true }});
              }}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={()=>navigate('/arena')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
                Go to Arena
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
            <h3 className="font-semibold mb-2">How it Works</h3>
            <ol className="list-decimal ml-5 text-sm opacity-90 space-y-2 leading-relaxed">
              <li><strong>Register</strong> a username.</li>
              <li><strong>Fund:</strong> leave Email empty → Demo. Add Email → Paystack Real.</li>
              <li><strong>Create/Join</strong> a match, then play in Arena.</li>
              <li><strong>Pauses:</strong> 5 per player per match.</li>
              <li><strong>Withdraw</strong> after adding payout account in Settings.</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}