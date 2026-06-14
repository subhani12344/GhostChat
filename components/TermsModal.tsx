'use client';

import React, { useState, useRef } from 'react';
import { ScrollText, Check } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

export default function TermsModal({ isOpen, onAccept }: TermsModalProps) {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isAccepted, setIsAccepted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;

    // Calculate if user scrolled to the bottom (within 5px tolerance)
    const isAtBottom =
      container.scrollHeight - container.scrollTop <= container.clientHeight + 5;

    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAccepted && hasScrolledToBottom) {
      localStorage.setItem('ghostchat_terms_accepted', 'true');
      onAccept();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-brand-gray-mid/30 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-brand-gray-mid/30 pb-4 mb-4 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gray-light border border-brand-gray-mid/30 text-brand-black">
            <ScrollText size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-brand-black">Terms & Conditions</h3>
            <p className="text-xs text-brand-black/50">Please review and accept our rules before entering</p>
          </div>
        </div>

        {/* Scrollable Terms Content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto pr-2 text-sm text-brand-black/70 space-y-4 mb-6 border border-brand-gray-mid/40 rounded-xl p-4 bg-brand-gray-light/20 scrollbar-thin scrollbar-thumb-brand-black/10"
        >
          <div className="space-y-4">
            <h4 className="font-bold text-brand-black text-base">Welcome to GhostChat</h4>
            <p className="leading-relaxed">
              GhostChat is a minimalist platform for video and text chat with strangers. By continuing, you agree to these Terms of Service. If you do not agree, you must exit this website.
            </p>

            <h5 className="font-bold text-brand-black mt-4">1. Safety & Age Limit</h5>
            <p className="leading-relaxed">
              You must be at least 18 years old to use GhostChat. We employ automated filters, logs, and a user reporting system to enforce these standards.
            </p>

            <div className="bg-red-50 rounded-xl p-4 border border-red-100/80 my-4 text-xs">
              <h6 className="font-bold uppercase tracking-wider text-red-700 mb-1">Strict Prohibition Notice</h6>
              <p className="text-red-600 mb-2 font-medium">
                GhostChat reserves the right to immediately terminate access or ban IP addresses for any user engaging in:
              </p>
              <ul className="list-disc pl-5 text-red-600 space-y-1">
                <li>Stalking, harassment, intimidation, or hate speech.</li>
                <li>Displaying sexually explicit material, adult media, or nudity.</li>
                <li>Conducting scams, phishing, spamming links, or distributing malware.</li>
                <li>Violating intellectual property rights or transmitting copyrighted material without license.</li>
              </ul>
            </div>

            <h5 className="font-bold text-brand-black mt-4">2. Banishment and Suspensions</h5>
            <p className="leading-relaxed">
              We monitor reports closely. If you are reported by multiple strangers, our system may trigger an automatic temporary or permanent ban of your account and IP address. Severe violations will result in permanent hardware ID (HWID) or IP range lockouts.
            </p>

            <h5 className="font-bold text-brand-black mt-4">3. Disclaimers</h5>
            <p className="leading-relaxed">
              GhostChat acts solely as an intermediary service. We are not responsible for the behavior of users, their statements, or any files/content shared during sessions. Use at your own discretion.
            </p>

            <h5 className="font-bold text-brand-black mt-4">4. Privacy Statement</h5>
            <p className="leading-relaxed">
              Conversations are ephemeral and peer-to-peer using WebRTC. We do not store transcripts or video streams. Standard logging is only utilized for active connection states, abuse prevention, and rate-limiting.
            </p>

            <p className="text-xs text-brand-black/40 mt-6 pt-4 border-t border-brand-gray-mid/20">
              * By scrolling to the bottom and confirming below, you represent that you are at least 18 years of age and agree to all clauses outlined above.
            </p>
          </div>
        </div>

        {/* Action Form */}
        <form onSubmit={handleSubmit} className="shrink-0 space-y-4">
          <div className="flex items-start gap-3">
            <div className="relative flex items-center h-5">
              <input
                id="terms-checkbox"
                type="checkbox"
                disabled={!hasScrolledToBottom}
                checked={isAccepted}
                onChange={(e) => setIsAccepted(e.target.checked)}
                className="h-5 w-5 rounded-md border-brand-gray-mid bg-white text-brand-black focus:ring-brand-black disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed transition-all"
              />
            </div>
            <label
              htmlFor="terms-checkbox"
              className={`text-xs select-none leading-5 font-semibold ${
                hasScrolledToBottom ? 'text-brand-black cursor-pointer' : 'text-brand-black/40 cursor-not-allowed'
              }`}
            >
              {!hasScrolledToBottom
                ? 'Please scroll to the bottom of the terms to enable this checkbox.'
                : 'I certify that I am at least 18 years old and agree to the terms above.'}
            </label>
          </div>

          <button
            type="submit"
            disabled={!isAccepted || !hasScrolledToBottom}
            className="w-full rounded-xl bg-brand-black py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            I Agree, Let's Go
          </button>
        </form>
      </div>
    </div>
  );
}
