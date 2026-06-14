'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import TermsModal from '@/components/TermsModal';
import CookieBanner from '@/components/CookieBanner';
import { Shield, Sparkles, MessageSquare, Globe, Smartphone, Zap } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [onlineCount, setOnlineCount] = useState(0);
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string | null>(null);
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

  useEffect(() => {
    // Check if terms accepted
    const accepted = localStorage.getItem('ghostchat_terms_accepted') === 'true';
    if (!accepted) {
      setShowTerms(true);
    }
  }, []);

  useEffect(() => {
    // Check logged in user
    const storedUser = localStorage.getItem('ghostchat_user');
    if (storedUser) setUser(JSON.parse(storedUser));

    // Fetch active counts and start 2s poll
    const fetchOnlineCount = () => {
      fetch(`${serverUrl}/health`)
        .then((res) => res.json())
        .then((data) => {
          setOnlineCount(data.online || 0);
        })
        .catch(() => {
          setOnlineCount(0);
        });
    };

    fetchOnlineCount();
    const intervalId = setInterval(fetchOnlineCount, 2000);

    return () => clearInterval(intervalId);
  }, [serverUrl]);

  const handleAnonymousChat = () => {
    const randomGuest = 'Guest_' + Math.floor(1000 + Math.random() * 9000);
    const mockToken = 'guest_token_' + Math.random().toString(36).substring(2);
    localStorage.setItem('ghostchat_token', mockToken);
    localStorage.setItem('ghostchat_user', JSON.stringify({ username: randomGuest }));
    setUser({ username: randomGuest });
    router.push('/chat?mode=video');
  };

  const handleChatStart = (targetPath: string) => {
    if (user) {
      router.push(targetPath);
    } else {
      setPendingRedirect(targetPath);
      setAuthOpen(true);
    }
  };

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
        onAnonymousChatClick={handleAnonymousChat}
      />

      {/* Hero Section */}
      <main className="flex-grow">
        <section className="relative flex flex-col items-center justify-center py-20 px-4 text-center sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-5xl font-extrabold tracking-tight text-brand-black sm:text-6xl lg:text-7xl leading-tight">
              Meet New People <br className="hidden sm:inline" />
              <span className="underline decoration-brand-gray-mid decoration-wavy">Instantly</span>
            </h1>
            <p className="text-base sm:text-lg text-brand-black/60 max-w-xl mx-auto leading-relaxed">
              Start anonymous text and video conversations with strangers around the world. No registration required.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <button
                onClick={() => handleChatStart('/chat?mode=video')}
                className="w-full sm:w-auto rounded-2xl bg-brand-black px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/95 active:scale-95 text-center shadow-md border border-brand-black cursor-pointer font-bold"
              >
                Start Video Chat
              </button>
              <button
                onClick={() => handleChatStart('/chat?mode=text')}
                className="w-full sm:w-auto rounded-2xl border border-brand-black bg-white px-8 py-4 text-sm font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-gray-light active:scale-95 text-center cursor-pointer font-bold"
              >
                Start Text Chat
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-brand-gray-light/30 border-t border-brand-gray-mid/30 py-20 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-12">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight text-brand-black sm:text-4xl">
                Why Choose GhostChat?
              </h2>
              <p className="text-sm text-brand-black/60 max-w-md mx-auto">
                Spontaneous pairing matched with modern privacy standards and safety filters.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="flex gap-4 rounded-2xl border border-brand-gray-mid/45 p-6 bg-white shadow-2xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gray-light border border-brand-gray-mid/30">
                  <MessageSquare size={20} className="text-brand-black" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-brand-black">Anonymous Chat</h3>
                  <p className="text-xs text-brand-black/55 leading-relaxed">
                    No sign-ups or profile setup required. Connect freely and stay completely anonymous.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex gap-4 rounded-2xl border border-brand-gray-mid/45 p-6 bg-white shadow-2xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gray-light border border-brand-gray-mid/30">
                  <Sparkles size={20} className="text-brand-black" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-brand-black">Instant Matching</h3>
                  <p className="text-xs text-brand-black/55 leading-relaxed">
                    Zero waiting queues. Instantly pair with active chat users in text or video mode.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex gap-4 rounded-2xl border border-brand-gray-mid/45 p-6 bg-white shadow-2xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gray-light border border-brand-gray-mid/30">
                  <Shield size={20} className="text-brand-black" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-brand-black">Safe Environment</h3>
                  <p className="text-xs text-brand-black/55 leading-relaxed">
                    Automated anti-abuse monitoring, live user reports, and matching block limits.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="flex gap-4 rounded-2xl border border-brand-gray-mid/45 p-6 bg-white shadow-2xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gray-light border border-brand-gray-mid/30">
                  <Globe size={20} className="text-brand-black" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-brand-black">Global Connections</h3>
                  <p className="text-xs text-brand-black/55 leading-relaxed">
                    Preferences let you specify matching criteria including Country and Language.
                  </p>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="flex gap-4 rounded-2xl border border-brand-gray-mid/45 p-6 bg-white shadow-2xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gray-light border border-brand-gray-mid/30">
                  <Smartphone size={20} className="text-brand-black" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-brand-black">Mobile Friendly</h3>
                  <p className="text-xs text-brand-black/55 leading-relaxed">
                    Designed from the ground up for tablets, mobile screens, and desktop viewports.
                  </p>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="flex gap-4 rounded-2xl border border-brand-gray-mid/45 p-6 bg-white shadow-2xs">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gray-light border border-brand-gray-mid/30">
                  <Zap size={20} className="text-brand-black" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-brand-black">Fast & Secure</h3>
                  <p className="text-xs text-brand-black/55 leading-relaxed">
                    WebRTC provides direct peer connection streams, keeping latency at a minimum.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <CookieBanner />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          if (pendingRedirect) {
            router.push(pendingRedirect);
            setPendingRedirect(null);
          }
        }}
        serverUrl={serverUrl}
      />

      <TermsModal
        isOpen={showTerms}
        onAccept={() => setShowTerms(false)}
      />
    </div>
  );
}
