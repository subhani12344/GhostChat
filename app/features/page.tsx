'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import { Shield, Sparkles, MessageSquare, Globe, Smartphone, Zap } from 'lucide-react';

export default function Features() {
  const [onlineCount, setOnlineCount] = useState(14285);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";

  useEffect(() => {
    const storedUser = localStorage.getItem('ghostchat_user');
    if (storedUser) setUser(JSON.parse(storedUser));

    fetch(`${serverUrl}/health`)
      .then((res) => res.json())
      .then((data) => setOnlineCount(data.online || 14285))
      .catch(() => {});
  }, [serverUrl]);

  const featuresList = [
    {
      icon: <MessageSquare size={24} className="text-brand-black" />,
      title: 'Anonymous Chat',
      desc: 'No registry required to chat. Start interacting instantly without exposing personal names or profile credentials.'
    },
    {
      icon: <Sparkles size={24} className="text-brand-black" />,
      title: 'Instant Matching',
      desc: 'Our scoring algorithm pairs you in seconds based on matching filters (Interests, Country, and Language preferences).'
    },
    {
      icon: <Shield size={24} className="text-brand-black" />,
      title: 'Safe Environment',
      desc: 'Equipped with user report metrics, instant blocks, client rate-limits, bad-word filters, and automated ban hammers.'
    },
    {
      icon: <Globe size={24} className="text-brand-black" />,
      title: 'Global Connections',
      desc: 'Meet users from all corners of the globe. Use language and country filters to narrow down your matching pools.'
    },
    {
      icon: <Smartphone size={24} className="text-brand-black" />,
      title: 'Mobile Friendly',
      desc: 'Responsive, mobile-first design. Camera video containers auto-fit any viewport with aspect-ratio preservation.'
    },
    {
      icon: <Zap size={24} className="text-brand-black" />,
      title: 'Fast & Secure',
      desc: 'Powered by WebRTC for peer-to-peer data streaming. Real-time signaling ensures zero-lag textual and visual chats.'
    }
  ];

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

      <main className="flex-grow py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">Platform Features</h1>
          <p className="text-lg text-brand-black/60 max-w-2xl mx-auto leading-relaxed">
            GhostChat integrates advanced real-time matching and security engines inside a minimalist interface.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-8">
          {featuresList.map((f, i) => (
            <div key={i} className="rounded-2xl border border-brand-gray-mid/60 p-6 bg-brand-gray-light/30 space-y-4 transition-all hover:-translate-y-0.5 hover:shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-brand-gray-mid/40 shadow-xs">
                {f.icon}
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-brand-black">{f.title}</h3>
                <p className="text-sm text-brand-black/60 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
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
