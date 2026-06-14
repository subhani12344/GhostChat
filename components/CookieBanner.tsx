'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('ghostchat_cookie_consent');
    if (!consent) {
      // Small delay for micro-animation feel
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('ghostchat_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem('ghostchat_cookie_consent', 'declined');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-2xl bg-brand-black p-5 text-white shadow-2xl md:left-auto md:right-4 border border-brand-gray-dark/30 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="space-y-4">
        <div className="space-y-2">
          <h5 className="font-bold text-sm tracking-wide">Cookie Policy</h5>
          <p className="text-xs text-brand-gray-light/75 leading-relaxed">
            We use cookies to maintain your session, authenticate logins, and improve matching speed. By clicking &quot;Accept All&quot;, you agree to our practices outlined in our{' '}
            <Link href="/privacy" className="underline hover:text-white transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAccept}
            className="flex-1 rounded-lg bg-white py-2 text-xs font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-gray-light active:scale-[0.98]"
          >
            Accept All
          </button>
          <button
            onClick={handleDecline}
            className="rounded-lg border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
