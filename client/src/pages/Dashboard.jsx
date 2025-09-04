// Dashboard.jsx
export default function Dashboard({ token, onBalance, socket, onCreated, onJoined }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT */}
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

        {/* RIGHT */}
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
            <div className="mt-3">
              <button
                onClick={()=>navigate('/arena')}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700">
                Go to Arena
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-gray-900/40 border border-gray-800 p-4">
            <h3 className="font-semibold mb-2">How it Works</h3>
            <ol className="list-decimal ml-5 text-sm opacity-90 space-y-2 leading-relaxed">
              <li><strong>Register:</strong> Pick a unique username. No KYC.</li>
              <li><strong>Secure your account:</strong> In <em>Settings → Security</em>, enable a Passkey and set your 6-digit Withdrawal PIN.</li>
              <li><strong>Fund your wallet:</strong>
                <ul className="list-disc ml-5 mt-1">
                  <li>Leave <em>Email empty</em> to credit <strong>Demo</strong> funds.</li>
                  <li>Enter your <em>Email</em> to pay via <strong>Paystack</strong> (Real funds).</li>
                </ul>
              </li>
              <li><strong>Create or Join:</strong> Create a match or enter a code. You’ll be taken to the <em>Arena</em>.</li>
              <li><strong>Arena:</strong> Open matches are split into Real/Demo. Each player has <strong>up to 5 pauses</strong>.</li>
              <li><strong>Payouts:</strong> Stakes escrowed; house rake applied; winner auto-paid on settlement.</li>
              <li><strong>Withdraw:</strong> Add payout account in <em>Settings</em>. Withdraw requires Passkey + PIN.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
