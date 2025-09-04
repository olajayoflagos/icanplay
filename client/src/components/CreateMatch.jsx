import React, { useState } from 'react';
import { api } from '../api';

const GAMES = ['chess','checkers','ludo','whot','archery','pool8lite'];

export default function CreateMatch({ token, onCreated }) {
  const [game, setGame]   = useState('chess');
  const [stake, setStake] = useState(0);
  const [demo, setDemo]   = useState(true);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState('');

  async function create() {
    setErr('');
    if (Number.isNaN(Number(stake)) || Number(stake) < 0) {
      setErr('Stake must be a non-negative number.');
      return;
    }
    try {
      setBusy(true);
      const r = await api(token).post('/api/matches', {
        game,
        stake: Number(stake),
        demo
      });
      onCreated && onCreated(r.data);
    } catch (e) {
      setErr('Could not create match. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-gray-900/40 border border-gray-800 p-3 space-y-3">
      <h3 className="font-semibold">Create Match</h3>

      {/* Stack on mobile, row on md+ */}
      <div className="flex flex-col gap-3 sm:gap-2 sm:flex-row sm:flex-wrap">
        {/* Game select */}
        <div className="flex items-center gap-2 sm:w-auto">
          <label className="shrink-0 text-sm opacity-80">Game</label>
          <select
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded text-black"
          >
            {GAMES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Stake input */}
        <div className="flex items-center gap-2 sm:w-auto">
          <label className="shrink-0 text-sm opacity-80">Stake ₦</label>
          <input
            type="number"
            min="0"
            inputMode="decimal"
            className="w-full sm:w-28 px-3 py-2 rounded text-black"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
        </div>

        {/* Demo toggle */}
        <label className="flex items-center gap-2 sm:w-auto">
          <input
            type="checkbox"
            checked={demo}
            onChange={(e) => setDemo(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">Demo (no real money)</span>
        </label>

        {/* Create button */}
        <div className="sm:ml-auto">
          <button
            onClick={create}
            disabled={busy}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-rose-400">{err}</div>}
    </div>
  );
}
