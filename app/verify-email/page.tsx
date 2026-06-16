'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Shield, 
  Mail, 
  ArrowRight, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  Edit2,
  Send
} from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialEmail = searchParams.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [otpCode, setOtpCode] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 
    (typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")  
      ? "https://ghostchat-backend.onrender.com" 
      : "http://localhost:4000");

  useEffect(() => {
    if (!initialEmail) {
      // If no email passed in search param, see if stored in local storage
      const stored = localStorage.getItem('ghostchat_unverified_email');
      if (stored) setEmail(stored);
    }
  }, [initialEmail]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otpCode) return;

    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch(`${serverUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'OTP verification failed');
      }

      localStorage.setItem('ghostchat_token', data.token);
      localStorage.setItem('ghostchat_user', JSON.stringify({ username: data.username }));
      
      setStatus('success');
      setTimeout(() => {
        router.push('/chat?mode=text');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const res = await fetch(`${serverUrl}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Resend request failed');

      alert('A new 6-digit confirmation code has been dispatched.');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) return;
    
    localStorage.setItem('ghostchat_unverified_email', email);
    setIsEditing(false);
    alert('Email address updated. Please request a new verification code.');
  };

  // Helper to open standard webmail providers
  const getMailProviderUrl = () => {
    if (email.endsWith('@gmail.com')) return 'https://mail.google.com';
    if (email.endsWith('@outlook.com') || email.endsWith('@hotmail.com') || email.endsWith('@live.com')) return 'https://outlook.live.com';
    if (email.endsWith('@yahoo.com')) return 'https://mail.yahoo.com';
    return 'https://mail.google.com'; // Default fallback
  };

  return (
    <div className="min-h-screen bg-[#060606] flex items-center justify-center relative overflow-hidden font-sans select-none text-white p-4">
      {/* Background Glows */}
      <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-rose-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8 sm:p-10 glass-dark space-y-6 shadow-2xl relative text-center">
        
        {/* Header Logo */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shadow-lg">
            <Mail className="w-7 h-7 text-rose-500 animate-bounce" />
          </div>
          <div>
            <h1 className="font-extrabold text-2xl tracking-wider bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">Verify Your Email</h1>
            <p className="text-xs text-neutral-400 mt-1">Check your inbox for the OTP verification code.</p>
          </div>
        </div>

        {status === 'success' && (
          <div className="bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-xs py-3 px-4 rounded-xl flex items-center justify-center space-x-2 animate-in fade-in duration-200">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Email verified successfully! Connecting...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-rose-500/10 border border-rose-500/35 text-rose-400 text-xs py-3 px-4 rounded-xl flex items-center justify-center space-x-2 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Email Address Display or Edit form */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col items-center space-y-2">
          {isEditing ? (
            <form onSubmit={handleEmailChange} className="flex gap-2 w-full">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 transition-all font-mono"
              />
              <button
                type="submit"
                className="px-3 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Save
              </button>
            </form>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-rose-300 font-bold select-all">{email || 'Not specified'}</span>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1 hover:bg-white/5 rounded text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <a
            href={getMailProviderUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-neutral-400 hover:text-white flex items-center space-x-1 transition-colors pt-1"
          >
            <span>Open Email App</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Verification code form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">6-Digit Verification Code</label>
            <input
              type="text"
              required
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 text-center text-lg font-bold tracking-[8px] focus:outline-none focus:border-rose-500 text-white transition-all outline-none"
            />
          </div>

          <div className="flex justify-between items-center text-xs">
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="text-rose-400 hover:text-rose-300 font-bold underline transition-colors cursor-pointer"
            >
              Resend Code
            </button>
            
            <Link href="/signup" className="text-neutral-400 hover:text-white transition-colors">
              Use a different account
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading || otpCode.length < 6 || status === 'success'}
            className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 active:scale-[0.98] transition-all text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-rose-900/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Verify & Activate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#060606] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
