// client/src/components/NavBar.jsx
import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthBar from './AuthBar.jsx';

export default function Navbar({ token, setToken, user, setUser, balance, setBalance }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile panel whenever the route changes
  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (to) => {
    if (to === '/') return pathname === '/';
    return pathname === to || pathname.startsWith(`${to}/`);
  };

  const link = (to, label) => (
    <Link
      to={to}
      onClick={() => setOpen(false)}
      className={
        'px-3 py-2 rounded-lg text-sm transition ' +
        (isActive(to) ? 'bg-gray-800 text-white' : 'hover:bg-gray-800/60 text-gray-200')
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-black/40 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-3 md:px-4">
        <div className="h-14 flex items-center gap-2">
          <Link to="/" className="font-extrabold text-lg tracking-tight">
            I Can Play
          </Link>

          <div className="flex-1" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2 mr-2">
            {link('/', 'Home')}
            {link('/dashboard', 'Dashboard')}
            {link('/arena', 'Arena')}
            {link('/settings', 'Settings')}
            {link('/admin', 'Admin')}
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:block">
            <AuthBar
              token={token}
              setToken={setToken}
              user={user}
              setUser={setUser}
              balance={balance}
              setBalance={setBalance}
            />
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg hover:bg-gray-800/60 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 focus:ring-offset-black/20"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6" fill="none">
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile panel */}
        {open && (
          <div
            id="mobile-menu"
            className="md:hidden pb-3 animate-in fade-in-0 slide-in-from-top-2"
          >
            <nav className="flex flex-col gap-1 mb-2">
              {link('/', 'Home')}
              {link('/dashboard', 'Dashboard')}
              {link('/arena', 'Arena')}
              {link('/settings', 'Settings')}
              {link('/admin', 'Admin')}
            </nav>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-2">
              <AuthBar
                token={token}
                setToken={setToken}
                user={user}
                setUser={setUser}
                balance={balance}
                setBalance={setBalance}
                compact
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
