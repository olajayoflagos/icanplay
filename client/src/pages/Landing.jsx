// client/src/pages/Landing.jsx
import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <main className="text-gray-100">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-700/40 via-indigo-900/30 to-black pointer-events-none" />
        <img
          src="https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1400&auto=format&fit=crop"
          alt=""
          className="h-[44vh] md:h-[58vh] w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-6xl mx-auto px-4 w-full">
            <div className="max-w-2xl">
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
                Play skill games for fun or for real.
              </h1>
              <p className="mt-3 md:mt-4 text-base md:text-lg text-gray-300">
                Create or join matches, practice with demo funds, and cash out when you win.
              </p>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold"
                >
                  Go to Dashboard
                </Link>
                <Link
                  to="/arena"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold"
                >
                  Open Arena
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip / quick features */}
      <section className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h3 className="font-semibold">Instant Start</h3>
            <p className="text-sm text-gray-400 mt-1">Register with a username only. No KYC to play.</p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h3 className="font-semibold">Demo & Real Wallets</h3>
            <p className="text-sm text-gray-400 mt-1">Practice with demo funds, deposit via Paystack for real games.</p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
            <h3 className="font-semibold">Escrow & Rake</h3>
            <p className="text-sm text-gray-400 mt-1">Stakes go to escrow; house takes a small rake on real matches.</p>
          </div>
        </div>
      </section>

      {/* How it Works (what you asked to be on the landing) */}
      <section className="max-w-6xl mx-auto px-4 pb-10 md:pb-14">
        <div className="rounded-3xl border border-gray-800 bg-gray-900/40 p-5 md:p-8">
          <h2 className="text-2xl md:text-3xl font-extrabold">How It Works</h2>

          <ol className="mt-5 space-y-4 md:space-y-3 list-decimal pl-5">
            <li className="text-gray-300">
              <span className="font-semibold text-white">Register:</span> Pick a unique username. No KYC required to play.
            </li>
            <li className="text-gray-300">
              <span className="font-semibold text-white">Secure your account:</span> In <span className="italic">Settings → Security</span>, enable a passkey (if supported) and set your 6-digit Withdrawal PIN.
            </li>
            <li className="text-gray-300">
              <span className="font-semibold text-white">Fund your wallets:</span> In <span className="italic">Dashboard → Wallet</span>:
              <ul className="list-disc pl-5 mt-2 text-sm text-gray-400">
                <li>Leave <span className="font-medium text-white">Email empty</span> to credit <span className="font-medium text-white">Demo</span> funds for practice.</li>
                <li>Enter <span className="font-medium text-white">Email</span> to deposit via <span className="font-medium text-white">Paystack</span> (Real funds).</li>
              </ul>
            </li>
            <li className="text-gray-300">
              <span className="font-semibold text-white">Create or join a match:</span> Use the Dashboard to create a match (choose game, stake, demo/real) or enter a match ID to join. You’ll be taken to the <span className="font-medium">Arena</span>.
            </li>
            <li className="text-gray-300">
              <span className="font-semibold text-white">Play:</span> Each player can pause up to <span className="font-medium">5</span> times per match.
              Spectators can watch and chat; voice is players-only.
            </li>
            <li className="text-gray-300">
              <span className="font-semibold text-white">Payouts:</span> Real stakes go to escrow; the house takes the configured rake.
              Winnings are credited automatically when the match settles.
            </li>
            <li className="text-gray-300">
              <span className="font-semibold text-white">Withdraw:</span> Add your payout account in <span className="italic">Settings</span>. Withdrawals require Passkey + PIN. Larger or risky withdrawals may go to manual review.
            </li>
            <li className="text-gray-300">
              <span className="font-semibold text-white">Auto-cancel:</span> Open matches older than 14 days are automatically cancelled; the house fee is deducted and funds are split back to players.
            </li>
          </ol>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold w-full sm:w-auto"
            >
              Get Started
            </Link>
            <Link
              to="/arena"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 font-semibold w-full sm:w-auto"
            >
              Browse Matches
            </Link>
          </div>
        </div>
      </section>

      {/* Games grid (dummy previews) */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <h2 className="text-xl md:text-2xl font-extrabold mb-4">Popular Games</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name:'Chess', img:'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?q=80&w=1400&auto=format&fit=crop', desc:'Capture the king by checkmate.' },
            { name:'Checkers', img:'https://images.unsplash.com/photo-1631815584585-3b08d2d28901?q=80&w=1400&auto=format&fit=crop', desc:'Jump and crown your pieces.' },
            { name:'Ludo', img:'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=1400&auto=format&fit=crop', desc:'Race tokens to home.' },
          ].map(g=>(
            <div key={g.name} className="rounded-2xl border border-gray-800 bg-gray-900/40 overflow-hidden">
              <img src={g.img} alt="" className="h-40 w-full object-cover opacity-80" />
              <div className="p-4">
                <div className="font-semibold">{g.name}</div>
                <p className="text-sm text-gray-400 mt-1">{g.desc}</p>
                <div className="mt-3 flex gap-2">
                  <Link to="/arena" className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold">Try Demo</Link>
                  <Link to="/dashboard" className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-semibold">Create Match</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-gray-800 bg-gray-900/40">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
            <div className="flex-1">
              <h3 className="text-xl md:text-2xl font-extrabold">Ready to play?</h3>
              <p className="text-gray-400 mt-1">Jump into a demo match or set stakes and challenge a friend.</p>
            </div>
            <div className="flex gap-3">
              <Link to="/arena" className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold">Open Arena</Link>
              <Link to="/dashboard" className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold">Create Match</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}