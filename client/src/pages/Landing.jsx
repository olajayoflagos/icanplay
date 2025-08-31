// client/src/pages/Landing.jsx
import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing(){
  return (
    <div className="space-y-10">
      <section className="grid md:grid-cols-2 gap-6 items-center">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
            Play. Compete. Win. <span className="text-emerald-400">I Can Play</span>.
          </h1>
          <p className="text-gray-300 md:text-lg">
            Real-time head-to-head games (Chess, Ludo, Checkers, Whot, Archery, 8-Ball Lite)
            with live chat, voice (players only), spectators, and fair payouts.
          </p>
          <div className="flex gap-3">
            <Link to="/dashboard" className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow">
              Dashboard
            </Link>
            <Link to="/arena" className="px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700">
              Visit Arena
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            Withdrawals & payout changes require Passkey + 6-digit PIN.
          </p>
        </div>
        <div className="rounded-2xl overflow-hidden border border-gray-800">
          <img
            alt="Players competing online"
            className="w-full h-64 md:h-[22rem] object-cover"
            src="https://images.unsplash.com/photo-1606112219348-204d7d8b94ee?q=80&w=1600&auto=format&fit=crop"
          />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { title:'Fair & Transparent', text:'Escrow + double-entry ledger. Rake configured site-wide.' },
          { title:'Chat & Voice', text:'Players talk while playing. Spectators chat.' },
          { title:'Secure Withdrawals', text:'Passkey (Face/Touch) + 6-digit PIN + payout allowlist.' },
        ].map((f,i)=>(
          <div key={i} className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
            <div className="text-lg font-semibold">{f.title}</div>
            <div className="text-sm opacity-80">{f.text}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl overflow-hidden border border-gray-800">
        <img
          alt="Game gallery"
          className="w-full h-48 md:h-72 object-cover"
          src="https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1600&auto=format&fit=crop"
        />
      </section>
    </div>
  );
}
