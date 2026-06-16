'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';

export default function CommunityGuidelines() {
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

      <main className="flex-grow py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <article className="prose prose-slate max-w-none space-y-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black mb-2">Community Guidelines</h1>
            <p className="text-sm text-brand-black/40">Last Updated: June 15, 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">1. Code of Conduct</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              GhostChat values inclusivity, respect, and positive communication. To protect our users, we require everyone to follow these simple rules:
            </p>
            <ul className="list-disc pl-5 text-sm text-brand-black/70 space-y-2">
              <li><strong>Be Respectful:</strong> Treat everyone with kindness. Do not make derogatory remarks about race, ethnicity, religion, gender, sexual orientation, or ability.</li>
              <li><strong>Respect Privacy:</strong> Never request or share private personal information (doxx, address, phone numbers, external social accounts) of other users.</li>
              <li><strong>No Hate Speech or Harassment:</strong> We have zero tolerance for verbal abuse, racial slurs, cyberbullying, or threat of violence.</li>
              <li><strong>No Spam or Commercial Ads:</strong> Do not use chats to promote products, websites, services, or repeatedly post copy-pasted referral links.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">2. Violation Penalties</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              Our safety teams and automated filters review incoming reports 24/7. Violators will face the following progressive penalty actions:
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-brand-gray-mid/60 p-4 bg-brand-gray-light">
                <h3 className="text-sm font-bold text-brand-black mb-1.5">Level 1: Warning</h3>
                <p className="text-xs text-brand-black/60 leading-relaxed">
                  For minor infractions. The user receives an in-app warning notification and brief match lock.
                </p>
              </div>
              <div className="rounded-xl border border-brand-gray-mid/60 p-4 bg-brand-gray-light">
                <h3 className="text-sm font-bold text-brand-black mb-1.5">Level 2: Temporary Ban</h3>
                <p className="text-xs text-brand-black/60 leading-relaxed">
                  For repeated minor rules violations or clear spam. Access is suspended for 24 hours to 7 days.
                </p>
              </div>
              <div className="rounded-xl border border-brand-gray-mid/60 p-4 bg-brand-gray-light">
                <h3 className="text-sm font-bold text-brand-black mb-1.5">Level 3: Permanent Ban</h3>
                <p className="text-xs text-brand-black/60 leading-relaxed">
                  For severe abuse, harassment, or sharing banned media. Device and IP address are permanently blacklisted.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">3. Reporting and Safety Systems</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              If a chat partner behaves inappropriately, click the <strong>&quot;Report&quot;</strong> button immediately. This flags their session metadata and forwards it to our moderation dashboard. You can also block the user to prevent future matching in the same queue.
            </p>
          </section>
        </article>
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
