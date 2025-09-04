// client/src/pages/Dashboard.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Wallet from '../components/Wallet.jsx';
import CreateMatch from '../components/CreateMatch.jsx';
import JoinMatch from '../components/JoinMatch.jsx';

export default function Dashboard({ token, onBalance, socket, onCreated, onJoined }) {
  const navigate = useNavigate();
  const [lastMatchId, setLastMatchId] = useState('');

  function handleCreated(m) {
    setLastMatchId(m?.id || '');
    onCreated?.(m);
    navigate('/arena', { state: { focusMatchId: m.id, started: true } });
  }

  function handleJoined(m) {
    onJoined?.(m);
    navigate('/arena', { state: { focusMatchId: m.id, started: true } });
  }

  return (
    <div className="max-w-6xl mx-auto px-3 md:px-4">
      {/* 2 cols on md+, single column on mobile */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Wallet */}
          <section className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
            <h3 className="font-semibold mb-2">Wallet</h3>
            <p className="text-sm text-gray-400 mb-3">
              Demo and Real balances; leave Email empty to credit <strong>Demo</strong>.
            </p>
            <Wallet token={token} onBalance={onBalance} />
          </section>

          {/* Create Match */}
          <section className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
            <h3 className="font-semibold mb-2">Create Match</h3>
            <CreateMatch token={token} onCreated={handleCreated} />

            {/* Show code of last created match so users can copy/share */}
            {lastMatchId && (
              <div className="mt-3 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
                <div className="text-sm text-gray-300">Match code</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="px-2 py-1 rounded bg-gray-800 text-xs break-all">
                    {lastMatchId}
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(lastMatchId)}
                    className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-xs"
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-400">
                  Share this code with your opponent, or paste it in <em>Join Match</em>.
                </div>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {/* Join Match */}
          <section className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4 shadow-lg">
            <h3 className="font-semibold mb-2">Join Match</h3>
            <p className="text-sm text-gray-400 mb-3">
              Paste the match code (UUID) you received and press Join.
            </p>
            <JoinMatch token={token} onJoined={handleJoined} />

            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => navigate('/arena')}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700"
              >
                Go to Arena
              </button>
            </div>
          </section>

          {/* Quick Tips (shortened; full How It Works is on Landing) */}
          <section className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
            <h3 className="font-semibold mb-2">Quick Tips</h3>
            <ol className="list-decimal ml-5 text-sm opacity-90 space-y-2 leading-relaxed">
              <li>
                <strong>Demo top-ups:</strong> In Wallet, leave <em>Email</em> empty to credit{' '}
                <strong>Demo</strong> funds. Enter your email to pay via <strong>Paystack</strong>.
              </li>
              <li>
                <strong>Create → Share:</strong> After creating, copy the match code and send it to
                your opponent. They can join from this page or the Arena.
              </li>
              <li>
                <strong>Pauses:</strong> Each player has up to <strong>5</strong> pauses per match.
              </li>
              <li>
                <strong>Auto-cancel:</strong> Open matches older than <strong>14 days</strong> are
                automatically cancelled; house fee is deducted and funds are split back to players.
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
