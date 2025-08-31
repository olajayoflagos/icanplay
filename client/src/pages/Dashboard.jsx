import React from 'react';
import { useNavigate } from 'react-router-dom';
import Wallet from '../components/Wallet.jsx';
import CreateMatch from '../components/CreateMatch.jsx';
import JoinMatch from '../components/JoinMatch.jsx';

export default function Dashboard({ token, onBalance, socket, onCreated, onJoined }){
  const navigate = useNavigate();

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
          <h3 className="font-semibold mb-2">Wallet</h3>
          <Wallet token={token} onBalance={onBalance} />
        </div>

        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
          <h3 className="font-semibold mb-2">Create Match</h3>
          <CreateMatch
            token={token}
            onCreated={(m)=>{
              onCreated(m);
              navigate('/arena', { state: { focusMatchId: m.id, started: true }});
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
          <h3 className="font-semibold mb-2">Join Match</h3>
          <JoinMatch
            token={token}
            onJoined={(m)=>{
              onJoined(m);
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
        </div>

        <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
          <h3 className="font-semibold mb-2">How it Works</h3>
          <ol className="list-decimal ml-5 text-sm opacity-90 space-y-2 leading-relaxed">
            <li><strong>Register:</strong> Pick a unique username. No KYC.</li>
            <li><strong>Secure your account:</strong> In <em>Settings → Security</em>, enable a Passkey (Face/Touch) and set your 6-digit Withdrawal PIN.</li>
            <li><strong>Fund your wallet:</strong> In the Wallet card: 
              <ul className="list-disc ml-5 mt-1">
                <li>Leave <em>Email empty</em> to credit <strong>Demo</strong> funds (for practice).</li>
                <li>Enter your <em>Email</em> to pay via <strong>Paystack</strong> (Real funds).</li>
              </ul>
            </li>
            <li><strong>Create or Join:</strong> Use the Dashboard to create a match or enter a match code to join. You’ll be taken to the <em>Arena</em>.</li>
            <li><strong>Arena:</strong> Choose a game, browse <em>Open Matches</em> (split into Real/Demo), join or watch. Players may pause a match—each player has <strong>up to 5 pauses</strong>.</li>
            <li><strong>Play & Communicate:</strong> Players can talk with built-in voice; everyone (players & spectators) can use chat and emojis.</li>
            <li><strong>Fair Payouts:</strong> Stakes go to escrow, house takes the configured rake, winner gets paid automatically once the match is settled.</li>
            <li><strong>Withdraw:</strong> Add your payout account in <em>Settings</em>. Withdrawing requires <strong>Passkey + PIN</strong>. Large or risky withdrawals go to manual review.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
