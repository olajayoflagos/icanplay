// client/src/components/WhatsAppFab.jsx
import React from 'react';

export default function WhatsAppFab({ phone = '2348012345678', message = 'Hi! I need help on I Can Play.' }) {
  const href = `https://wa.me/+2348114879899`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed z-40 right-4 bottom-4 h-14 w-14 rounded-full bg-[#25D366] shadow-lg grid place-items-center hover:brightness-110 active:scale-95 transition"
    >
      {/* WhatsApp SVG icon */}
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M19.1 17.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-1.6-.8-2.6-1.4-3.6-3.2-.3-.3 0-.5.1-.7.2-.2.3-.3.5-.6.2-.2.2-.4.3-.6.1-.2 0-.5 0-.7 0-.2-.7-1.8-1-2.5-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.1 1.4 3.3c.2.3 2.4 3.6 5.8 5 3.4 1.4 3.4.9 4 .9.6-.1 2-0.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.6-.3zM15.9 28C9.9 28 5 23.1 5 17.1 5 11 9.9 6.1 15.9 6.1S26.8 11 26.8 17.1C26.8 23.1 21.9 28 15.9 28zm0-22.6C9.1 5.4 3.9 10.6 3.9 17.4c0 1.9.5 3.7 1.4 5.3L3 29l6.4-2.1c1.6.9 3.4 1.4 5.3 1.4 6.8 0 12-5.2 12-11.9C26.7 10.6 22.6 5.4 15.9 5.4z"/>
      </svg>
    </a>
  );
}