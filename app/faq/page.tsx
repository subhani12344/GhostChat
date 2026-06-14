'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';

export default function FAQ() {
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

  const faqItems = [
    {
      q: 'Do I need an account to use GhostChat?',
      a: 'No! Account registration is completely optional. Guests can click "Start Chatting" and enter active chat matching in 5 seconds. Saving a user account simply lets you persist custom tags and profile options.'
    },
    {
      q: 'Is my camera feed recorded or stored?',
      a: 'Absolutely not. All video and audio streams are sent directly between users using WebRTC Peer-to-Peer protocols. The stream data is never routed through, intercepted, or saved on our servers.'
    },
    {
      q: 'How does interest-based matching work?',
      a: 'When you enter a list of interest tags (e.g. "gaming", "music"), our backend matches you with waiting partners who share the highest overlap of tags. If no overlap matches are waiting, the system pairs you with standard users to minimize wait times.'
    },
    {
      q: 'Why can I not access video chat?',
      a: 'Verify that you have given your browser permission to access your camera and microphone. If your devices are locked by another application, restart your browser and try again.'
    },
    {
      q: 'What should I do if a user violates rules?',
      a: 'Click the "Report" button in the control panel. This immediately drops the connection and files a report record in our moderation logs. Repeated reports will trigger automated HWID/IP bans for that user.'
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

      <main className="flex-grow py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-brand-black sm:text-5xl">Frequently Asked Questions</h1>
          <p className="text-lg text-brand-black/60 max-w-2xl mx-auto leading-relaxed">
            Quick answers about connections, privacy, matching queues, and safety filters.
          </p>
        </div>

        <div className="space-y-8 pt-8">
          {faqItems.map((item, index) => (
            <div key={index} className="space-y-2 border-b border-brand-gray-mid/30 pb-6">
              <h3 className="text-lg font-bold text-brand-black flex items-start gap-2">
                <span className="text-brand-black/40 font-mono">Q:</span>
                {item.q}
              </h3>
              <p className="text-sm text-brand-black/70 leading-relaxed pl-6">
                {item.a}
              </p>
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
