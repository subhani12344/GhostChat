'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertTriangle, Shield } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const provider = state || (window.location.search.includes('github') ? 'github' : 'google');

    if (!code) {
      setError('OAuth authorization code was not returned from identity provider.');
      return;
    }

    const exchangeCode = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/auth/oauth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, provider })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'OAuth authentication failed.');
        }

        // Store session JWT
        localStorage.setItem('ghostchat_token', data.token);
        localStorage.setItem('ghostchat_user', JSON.stringify({ username: data.username }));

        // Redirect to chat
        router.push('/chat?mode=text');
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Unable to authenticate with GhostChat server.');
      }
    };

    exchangeCode();
  }, [searchParams, router, serverUrl]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#060606] flex items-center justify-center text-white p-6">
        <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-8 glass-dark text-center space-y-4 shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg tracking-wider">Authentication Error</h2>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-3 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold transition-all cursor-pointer text-white shadow-lg shadow-rose-950/20"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060606] flex flex-col items-center justify-center text-white space-y-4">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/20 animate-pulse">
        <Shield className="w-6 h-6 text-white" />
      </div>
      <div className="flex flex-col items-center space-y-1 text-center animate-pulse">
        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
        <span className="text-[10px] text-neutral-400 tracking-wider font-semibold uppercase">Verifying Credentials...</span>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060606] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
