// client/src/components/Navbar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthBar from './AuthBar.jsx';

export default function Navbar({ token, setToken, user, setUser, balance }){
  const { pathname } = useLocation();
  const link = (to, label) => (
    <Link to={to}
      className={'px-3 py-2 rounded-xl text-sm '+(pathname===to?'bg-gray-800':'hover:bg-gray-800/60')}>
      {label}
    </Link>
  );
  return (
    <div className="sticky top-0 z-30 backdrop-blur bg-black/40 border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-3 md:px-4 py-2 flex items-center gap-2">
        <Link to="/" className="font-bold text-lg tracking-tight">
          I Can Play
        </Link>
        <div className="flex-1" />
        <nav className="hidden sm:flex items-center gap-2">
          {link('/', 'Home')}
          {link('/dashboard', 'Dashboard')}
          {link('/arena', 'Arena')}
          {link('/settings', 'Settings')}
          {link('/admin', 'Admin')}
        </nav>
        <div className="sm:hidden">{link('/dashboard', 'Dashboard')}</div>
        <div className="ml-2">
          <AuthBar token={token} setToken={setToken} user={user} setUser={setUser} balance={balance} setBalance={()=>{}} />
        </div>
      </div>
    </div>
  );
}
