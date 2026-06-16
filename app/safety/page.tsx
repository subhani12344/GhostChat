'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { Shield, ShieldAlert, EyeOff, Ban } from 'lucide-react';

export default function SafetyCenter() {
  const [onlineCount, setOnlineCount] = useState(14285);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || (typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1") ? "https://ghostchat-backend.onrender.com" : "http://localhost:4000");

  useEffect(() => {
    const storedUser = localStorage.getItem('ghostchat_user');
    if (storedUser) setUser(JSON.parse(storedUser));

    fetch(`${serverUrl}/health`)
      .then((res) => res.json())
      .then((data) => setOnlineCount(data.online || 14285))
      .catch(() => {});
  }, [serverUrl]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar
        onlineCount={onlineCount}
        user={user}
        onAuthClick={() => setAuthOpen(true)}
        onLogout={() => {
          localStorage.removeItem('ghostchat_token');
          localStorage.removeItem('ghostchat_user');
          setUser(null);
        }}
      />

      <main className="flex-grow py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">Safety Center</h1>
          <p className="text-lg text-brand-black/60 max-w-2xl mx-auto leading-relaxed">
            Your safety and privacy are our highest priorities. Learn how we moderate interactions and how you can protect yourself.
          </p>
        </div>

        <section className="space-y-6 pt-8">
          {/* Safe Behaviors card */}
          <div className="rounded-2xl border border-brand-gray-mid/60 p-6 bg-brand-gray-light/30 space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="text-brand-black shrink-0" size={24} />
              <h2 className="text-xl font-bold text-brand-black">Best Practices for Chatting Safely</h2>
            </div>
            <ul className="list-disc pl-5 text-sm text-brand-black/70 space-y-2 leading-relaxed">
              <li><strong>Do not share personal info:</strong> Keep your real name, email address, physical address, and social handles private.</li>
              <li><strong>Stay on the platform:</strong> Avoid clicking links that attempt to move the conversation to external chat channels.</li>
              <li><strong>Remember video is visual:</strong> Do not show credentials, faces, or sensitive items on screen if you wish to remain completely anonymous.</li>
              <li><strong>Report bad behavior:</strong> Never hesitate to click the &quot;Report&quot; button if a chat partner violates community rules.</li>
            </ul>
          </div>

          {/* Core safety features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="rounded-xl border border-brand-gray-mid/60 p-5 space-y-3">
              <ShieldAlert className="text-brand-black" size={20} />
              <h3 className="text-md font-bold text-brand-black">Report System</h3>
              <p className="text-xs text-brand-black/60 leading-relaxed">
                Matches are automatically flagged and queued for review once reported. High volumes of reports lead to automated match lockouts.
              </p>
            </div>
            <div className="rounded-xl border border-brand-gray-mid/60 p-5 space-y-3">
              <EyeOff className="text-brand-black" size={20} />
              <h3 className="text-md font-bold text-brand-black">Block System</h3>
              <p className="text-xs text-brand-black/60 leading-relaxed">
                Blocking a user instantly drops the websocket connection and blacklists their socket ID/IP from pairing with you in the future.
              </p>
            </div>
            <div className="rounded-xl border border-brand-gray-mid/60 p-5 space-y-3">
              <Ban className="text-brand-black" size={20} />
              <h3 className="text-md font-bold text-brand-black">Ban System</h3>
              <p className="text-xs text-brand-black/60 leading-relaxed">
                We implement IP and hardware bans. Ban durations range from 24-hour cooling-off blocks up to permanent access bans.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={(u) => setUser(u)}
        serverUrl={serverUrl}
      />
    </div>
  );
}
