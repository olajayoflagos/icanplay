import React, { useState } from 'react';
import { api } from '../api';

export default function JoinMatch({ token, onJoined }) {
  const [matchId, setMatchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function join() {
    if (!matchId.trim()) {
      setErr('Please enter a match ID.');
      return;
    }
    try {
      setBusy(true);
      setErr('');
      const r = await api(token).post(`/api/matches/${matchId}/join`, {});
      onJoined && onJoined({ ...r.data, id: matchId });
      setMatchId('');
    } catch (e) {
      setErr('Could not join match. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-2">
      <h3 className="font-semibold">Join Match</h3>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input
          value={matchId}
          onChange={(e) => setMatchId(e.target.value)}
          placeholder="Match ID (UUID)"
          className="flex-1 px-3 py-2 rounded text-black"
        />
        <button
          onClick={join}
          disabled={busy}
          className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
      </div>

      {err && <div className="text-sm text-rose-400">{err}</div>}

      <p className="text-xs text-gray-400">
        Ask the match creator for the match ID they received.
      </p>
    </div>
  );
}
