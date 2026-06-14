'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Mail, User, ShieldAlert, KeyRound, Clock, RotateCcw } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: { username: string; token: string }) => void;
  serverUrl: string;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, serverUrl }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<'auth' | 'otp'>('auth');
  
  // Registration / Login Inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  
  // OTP states
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [timer, setTimer] = useState(120); // 2 minutes in seconds
  const [resendCount, setResendCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset states when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      // Reset state
      setStep('auth');
      setUsername('');
      setPassword('');
      setEmail('');
      setOtp(Array(6).fill(''));
      setError('');
      setIsLocked(false);
      setTimer(120);
      setResendCount(0);
    }
  }, [isOpen]);

  // Countdown timer for OTP
  useEffect(() => {
    if (step !== 'otp' || timer <= 0 || isLocked) return;

    const intervalId = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [step, timer, isLocked]);

  if (!isOpen) return null;

  // Handle Form Submission (Login or Register Request)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isLogin) {
      try {
        const response = await fetch(`${serverUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Authentication failed');

        localStorage.setItem('ghostchat_token', data.token);
        localStorage.setItem('ghostchat_user', JSON.stringify({ username: data.username }));
        onAuthSuccess({ username: data.username, token: data.token });
        onClose();
      } catch (err: any) {
        console.error(err);
        if (err.message.includes('Failed to fetch')) {
          // Fallback offline simulator if backend is offline
          const mockToken = 'mock_jwt_token_' + Math.random().toString(36).substr(2);
          localStorage.setItem('ghostchat_token', mockToken);
          localStorage.setItem('ghostchat_user', JSON.stringify({ username }));
          onAuthSuccess({ username, token: mockToken });
          onClose();
        } else {
          setError(err.message || 'Invalid credentials');
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Registration request
      try {
        const response = await fetch(`${serverUrl}/api/auth/register-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
        
        if (response.status === 403) {
          setIsLocked(true);
          throw new Error(data.message || 'Registration is locked.');
        }
        if (!response.ok) throw new Error(data.message || 'Registration failed');

        // Transition to OTP step
        setStep('otp');
        setTimer(120);
        setResendCount(0);
        setError('');
      } catch (err: any) {
        console.error(err);
        if (err.message.includes('Failed to fetch')) {
          // Offine simulator register bypass
          const mockToken = 'mock_jwt_token_' + Math.random().toString(36).substr(2);
          localStorage.setItem('ghostchat_token', mockToken);
          localStorage.setItem('ghostchat_user', JSON.stringify({ username }));
          onAuthSuccess({ username, token: mockToken });
          onClose();
        } else {
          setError(err.message || 'An error occurred during registration request.');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle OTP digit changes
  const handleOtpChange = (val: string, index: number) => {
    // Only accept numeric digits
    if (val !== '' && !/^[0-9]$/.test(val)) return;

    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto-focus next input
    if (val !== '' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP backspace navigation
  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else if (otp[index] !== '') {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
  };

  // Handle OTP copy-paste
  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasteData = e.clipboardData.getData('text').trim();
    if (pasteData.length === 6 && !isNaN(Number(pasteData))) {
      const pasteOtp = pasteData.split('');
      setOtp(pasteOtp);
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  // Verify OTP submission
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const otpCodeString = otp.join('');
    if (otpCodeString.length < 6) {
      setError('Please enter all 6 digits of the verification code.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCodeString })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'OTP verification failed');

      // Success - Authenticate
      localStorage.setItem('ghostchat_token', data.token);
      localStorage.setItem('ghostchat_user', JSON.stringify({ username: data.username }));
      onAuthSuccess({ username: data.username, token: data.token });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP logic
  const handleResendOtp = async () => {
    if (timer > 0 || isLocked) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${serverUrl}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();

      if (response.status === 403) {
        setIsLocked(true);
        throw new Error(data.message || 'Registration session has been locked.');
      }
      if (!response.ok) throw new Error(data.message || 'Resend request failed');

      // Success resending
      setTimer(120);
      setOtp(Array(6).fill(''));
      setResendCount(data.resend_count || (resendCount + 1));
      setError('');
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to resend code at this time.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    const randomGuest = 'Guest_' + Math.floor(1000 + Math.random() * 9000);
    const mockToken = 'guest_token_' + Math.random().toString(36).substr(2);
    localStorage.setItem('ghostchat_token', mockToken);
    localStorage.setItem('ghostchat_user', JSON.stringify({ username: randomGuest }));
    onAuthSuccess({ username: randomGuest, token: mockToken });
    onClose();
  };

  // Helper: Format timer seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-brand-gray-mid/30 animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-brand-black/40 hover:text-brand-black transition-colors"
        >
          <X size={20} />
        </button>

        {step === 'auth' ? (
          <>
            {/* Heading */}
            <div className="mb-6 text-center">
              <h3 className="text-xl font-bold tracking-tight text-brand-black">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h3>
              <p className="text-xs text-brand-black/50 mt-1">
                {isLogin ? 'Sign in to access custom matches' : 'Register to save your interests and tags'}
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-black/60">Username</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-brand-black/40">
                    <User size={15} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 pl-10 pr-4 text-sm text-brand-black placeholder-brand-black/30 outline-none transition-all focus:border-brand-black focus:bg-white"
                  />
                </div>
              </div>

              {/* Email Input (Register Only) */}
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-brand-black/60">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-brand-black/40">
                      <Mail size={15} />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 pl-10 pr-4 text-sm text-brand-black placeholder-brand-black/30 outline-none transition-all focus:border-brand-black focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Password Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-black/60">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-brand-black/40">
                    <Lock size={15} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 pl-10 pr-4 text-sm text-brand-black placeholder-brand-black/30 outline-none transition-all focus:border-brand-black focus:bg-white"
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full rounded-lg bg-brand-black py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 disabled:opacity-50"
              >
                {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs text-brand-black/60 border-t border-brand-gray-mid/30 pt-4">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="hover:text-brand-black underline font-medium"
              >
                {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
              </button>

              <button
                onClick={handleGuestAccess}
                className="hover:text-brand-black underline font-bold uppercase tracking-wide"
              >
                Enter as Guest
              </button>
            </div>
          </>
        ) : (
          /* OTP VERIFICATION VIEW */
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gray-light border border-brand-gray-mid/40 text-brand-black">
                <KeyRound size={22} />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-brand-black">Verify Your Email</h3>
              <p className="text-xs text-brand-black/50 mt-1.5 px-4">
                We sent a 6-digit confirmation code to: <br />
                <span className="font-semibold text-brand-black">{email}</span>
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <p className="flex-1">{error}</p>
              </div>
            )}

            {isLocked ? (
              <div className="text-center py-6 space-y-4">
                <div className="text-sm font-bold text-red-600">
                  Account registration is locked due to too many resend attempts.
                </div>
                <p className="text-xs text-brand-black/50 leading-relaxed px-4">
                  For security reasons, you cannot create or verify accounts on this email for the next 18 hours. Please check back later.
                </p>
                <button
                  type="button"
                  onClick={() => setStep('auth')}
                  className="rounded-lg border border-brand-gray-mid/80 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-brand-black transition-all hover:bg-brand-gray-light"
                >
                  Go Back
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                {/* 6 digits OTP input boxes */}
                <div className="flex justify-center gap-2.5">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      onChange={(e) => handleOtpChange(e.target.value, idx)}
                      onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                      onPaste={handleOtpPaste}
                      className="h-12 w-10 text-center text-lg font-bold border border-brand-gray-mid/60 bg-brand-gray-light/35 rounded-lg focus:border-brand-black focus:bg-white outline-none transition-all"
                    />
                  ))}
                </div>

                {/* Resend / Countdown timer controls */}
                <div className="flex flex-col items-center justify-center gap-2.5 text-xs">
                  {timer > 0 ? (
                    <div className="flex items-center gap-1.5 text-brand-black/50 font-medium">
                      <Clock size={13} />
                      <span>Code expires in <span className="font-bold text-brand-black">{formatTime(timer)}</span></span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-brand-black hover:underline active:scale-95 disabled:opacity-50"
                    >
                      <RotateCcw size={13} />
                      Resend Code
                    </button>
                  )}

                  {resendCount > 0 && !isLocked && (
                    <span className="text-[10px] text-brand-black/40 font-semibold uppercase tracking-wider">
                      Resends: {resendCount} / 3 attempts
                    </span>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('auth');
                      setError('');
                    }}
                    className="flex-1 rounded-lg border border-brand-gray-mid/60 bg-white py-2.5 text-xs font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-gray-light active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 rounded-lg bg-brand-black py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
