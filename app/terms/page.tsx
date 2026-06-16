'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';

export default function TermsOfService() {
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
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-black mb-2">Terms of Service</h1>
            <p className="text-sm text-brand-black/40">Last Updated: June 15, 2026</p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">1. Acceptable Use</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              GhostChat is a platform for spontaneous and positive social interaction. You must be at least 18 years old or the minimum legal age of majority in your jurisdiction to use this platform.
            </p>
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-red-700 mb-2">Prohibited Conduct</h4>
              <p className="text-xs text-red-600 leading-relaxed">
                Users are strictly prohibited from engaging in the following actions:
              </p>
              <ul className="list-disc pl-5 text-xs text-red-600 mt-2 space-y-1">
                <li>Harassing, threatening, stalking, or intimidating other chat partners.</li>
                <li>Sharing illegal content, sexually explicit material, adult content, or nudity.</li>
                <li>Sharing copyrighted files, videos, or assets without explicit permission.</li>
                <li>Distributing malware, viruses, phishing links, or scam material.</li>
                <li>Impersonating individuals or conducting fraudulent operations.</li>
              </ul>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">2. Account Suspension & Banishment</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              GhostChat utilizes automated spam detection, AI filters, and user report metrics. We reserve the absolute right to:
            </p>
            <ul className="list-disc pl-5 text-sm text-brand-black/70 space-y-1">
              <li>Instantly remove offensive files or media.</li>
              <li>Suspend user profiles or access tokens without warning.</li>
              <li>Implement temporary IP bans (ranging from 24 hours to 7 days).</li>
              <li>Impose permanent HWID/IP bans for severe, repeated violations.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">3. Disclaimers & Limitations</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              Conversations on GhostChat occur directly between users. We are not responsible for user-generated content, behaviors, or interactions.
            </p>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              The platform is provided <strong>&quot;as is&quot;</strong> and <strong>&quot;as available&quot;</strong>, without warranties of any kind, either express or implied, including warranties of merchantability or fitness for a particular purpose.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-brand-black border-b border-brand-gray-mid/30 pb-2">4. DMCA / Copyright Policy</h2>
            <p className="text-sm text-brand-black/70 leading-relaxed">
              If you believe any content on the site infringes your copyright, please submit a written DMCA takedown notice containing proof of ownership, a description of the copyrighted work, and contact details via our Contact page.
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
