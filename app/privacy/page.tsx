'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';

export default function PrivacyPolicy() {
  const [onlineCount, setOnlineCount] = useState(0);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";

  useEffect(() => {
    // Load auth
    const storedUser = localStorage.getItem('ghostchat_user');
    if (storedUser) setUser(JSON.parse(storedUser));

    // Fetch live users count
    fetch(`${serverUrl}/health`)
      .then((res) => res.json())
      .then((data) => setOnlineCount(data.online || 0))
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
        onAuthSuccess={(u) => setUser(u)}
      />

      <main className="flex-grow py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <article className="prose prose-slate max-w-none space-y-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black mb-2">Privacy Policy</h1>
            <p className="text-sm text-brand-black/40">Last Updated: June 15, 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">1. Introduction</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              Welcome to GhostChat. We are committed to protecting your privacy and security when you use our anonymous video, voice, and text chat services. This Privacy Policy describes how we handle information, the rights you hold over your data, and how we keep the community safe.
            </p>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              By accessing and using GhostChat, you agree to the practices described in this policy. If you do not agree, please do not use our services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">2. Information We Collect</h2>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-brand-black">A. Information You Provide</h3>
              <ul className="list-disc pl-5 text-sm text-brand-black/70 space-y-1">
                <li><strong>Username & Email:</strong> Collected only when creating a persistent registered account. Guest users do not need to provide these.</li>
                <li><strong>Profile Details:</strong> Saved interests/tags and account preferences.</li>
                <li><strong>Communications:</strong> Support tickets, contact form requests, or abuse reports.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-brand-black">B. Information Collected Automatically</h3>
              <ul className="list-disc pl-5 text-sm text-brand-black/70 space-y-1">
                <li><strong>IP Address:</strong> Logged temporarily to maintain peer signaling, run spam detection algorithms, block malicious activity, and implement temporary or permanent bans.</li>
                <li><strong>Device & Connection Metadata:</strong> OS type, browser settings, language selections, and camera/microphone status.</li>
                <li><strong>Usage Statistics:</strong> Clicked elements, duration of peer chats, and matching filters configured.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">3. Camera & Microphone Access</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              To engage in voice or video chats, the platform requires access to your camera and microphone.
            </p>
            <div className="bg-brand-gray-light rounded-xl p-4 border border-brand-gray-mid/40">
              <p className="text-xs text-brand-black/80 font-semibold leading-relaxed">
                ⚠️ IMPORTANT: We only access your camera and microphone after you grant explicit browser permission. Audio and video streams are transmitted peer-to-peer (directly between you and your partner) using WebRTC and are NOT recorded, intercepted, or stored on our servers unless explicitly stated for moderation checks.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">4. GDPR & India DPDP Act Compliance</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              We operate under global privacy frameworks including the General Data Protection Regulation (GDPR) and India’s Digital Personal Data Protection (DPDP) Act.
            </p>
            <ul className="list-disc pl-5 text-sm text-brand-black/70 space-y-1">
              <li><strong>Right to be Forgotten:</strong> You can submit a deletion request to purge your registered profile, reported tags, or usage traces.</li>
              <li><strong>Consent Withdrawal:</strong> You can withdraw consent for camera/mic permissions in your browser settings at any time.</li>
              <li><strong>Data Portability:</strong> Users may request a file containing all saved profile fields and custom configurations.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">5. Data Retention & Sharing</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              We do not sell, rent, or trade your personal data. Chat metadata is flushed immediately upon disconnecting from a session. Registered user profiles and user report logs are retained only as long as necessary for administrative and safety compliance. We share credentials only with legal authorities in response to valid court orders.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">6. Contact & Support</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              For privacy queries or request forms, please contact us via our Contact page.
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
