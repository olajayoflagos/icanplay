import React from 'react';

export default function WhatsAppFAB(){
  const href = 'https://wa.me/2340000000000?text=Hello%20I%20Can%20Play'; // placeholder
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className="fixed bottom-4 right-4 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-2xl">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5" aria-hidden>
        <path fill="currentColor" d="M...Z" />
      </svg>
      <span className="font-semibold">WhatsApp</span>
    </a>
  );
}
