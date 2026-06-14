'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';

export default function AboutUs() {
  const [onlineCount, setOnlineCount] = useState(14285);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

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
          <h1 className="text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">About GhostChat</h1>
          <p className="text-lg text-brand-black/60 max-w-2xl mx-auto leading-relaxed">
            We build simple, fast, and secure tools to help you connect with new people instantly, without barriers or friction.
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black">Our Philosophy</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              Social platforms have become cluttered with complex profiles, algorithms, and ad feeds that filter what you see. We believe in returning to the basics: spontaneous, anonymous conversation.
            </p>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              Whether you are looking to practice a language, explore different cultures, or simply have a quick chat during a break, GhostChat pairs you instantly with a random companion.
            </p>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black">High-Performance Tech Stack</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              GhostChat is optimized for latency, accessibility, and high performance:
            </p>
            <ul className="list-disc pl-5 text-sm text-brand-black/70 space-y-1">
              <li><strong>Frontend:</strong> Next.js App Router & React components with Tailwind CSS v4 styling.</li>
              <li><strong>Signaling Server:</strong> Lightweight Node.js and Socket.IO infrastructure.</li>
              <li><strong>Video Stream:</strong> Peer-to-peer WebRTC connections routed through public STUN/TURN nodes.</li>
              <li><strong>Database:</strong> PostgreSQL connection pool with local SQLite/JSON caching.</li>
            </ul>
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
