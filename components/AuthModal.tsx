'use client';

import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User, ShieldAlert } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: { username: string; token: string }) => void;
  serverUrl: string;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, serverUrl }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Registration / Login Inputs
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password checker criteria
  const hasCap = /[A-Z]/.test(password);
  const hasSmall = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasMinLen = password.length >= 8;
  const isPasswordValid = hasCap && hasSmall && hasNumber && hasSymbol && hasMinLen;
  const passwordsMatch = password === confirmPassword;

  // Reset states when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setUsername('');
      setPassword('');
      setEmail('');
      setConfirmPassword('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Form Submission (Login or Direct Register)
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
          const mockToken = 'mock_jwt_token_' + Math.random().toString(36).substring(2);
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
      // Validate strength & match first
      if (!isPasswordValid) {
        setError('Password does not meet all verification rules.');
        setLoading(false);
        return;
      }
      if (!passwordsMatch) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }

      // Direct registration (No OTP)
      try {
        const response = await fetch(`${serverUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message || 'Registration failed');

        localStorage.setItem('ghostchat_token', data.token);
        localStorage.setItem('ghostchat_user', JSON.stringify({ username: data.username }));
        onAuthSuccess({ username: data.username, token: data.token });
        onClose();
      } catch (err: any) {
        console.error(err);
        if (err.message.includes('Failed to fetch')) {
          // Offline simulator register bypass
          const mockToken = 'mock_jwt_token_' + Math.random().toString(36).substring(2);
          localStorage.setItem('ghostchat_token', mockToken);
          localStorage.setItem('ghostchat_user', JSON.stringify({ username }));
          onAuthSuccess({ username, token: mockToken });
          onClose();
        } else {
          setError(err.message || 'An error occurred during account creation.');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-brand-gray-mid/30 animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-brand-black/40 hover:text-brand-black transition-colors cursor-pointer"
        >
          <X size={20} />
        </button>

        {/* Heading */}
        <div className="mb-6 text-center">
          <h3 className="text-xl font-bold tracking-tight text-brand-black">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h3>
          <p className="text-xs text-brand-black/50 mt-1">
            {isLogin ? 'Sign in to access custom matches' : 'Register directly to save your interests and tags'}
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-600 border border-red-100">
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            <p className="flex-1">{error}</p>
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

          {/* Confirm Password Input (Register Only) */}
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-black/60">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-brand-black/40">
                  <Lock size={15} />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 pl-10 pr-4 text-sm text-brand-black placeholder-brand-black/30 outline-none transition-all focus:border-brand-black focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* Password Validation Requirements Checklist */}
          {!isLogin && password && (
            <div className="rounded-xl border border-brand-gray-mid/45 p-3.5 bg-brand-gray-light/10 text-brand-black/75 space-y-2 mt-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-black/40 mb-1">
                Password Requirements
              </p>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-2xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full transition-all duration-300 ${hasMinLen ? 'bg-green-500' : 'bg-brand-gray-mid/90'}`} />
                  <span className={hasMinLen ? 'text-brand-black font-medium' : 'text-brand-black/45'}>8+ Characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full transition-all duration-300 ${hasCap ? 'bg-green-500' : 'bg-brand-gray-mid/90'}`} />
                  <span className={hasCap ? 'text-brand-black font-medium' : 'text-brand-black/45'}>Capital Letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full transition-all duration-300 ${hasSmall ? 'bg-green-500' : 'bg-brand-gray-mid/90'}`} />
                  <span className={hasSmall ? 'text-brand-black font-medium' : 'text-brand-black/45'}>Lowercase Letter</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full transition-all duration-300 ${hasNumber ? 'bg-green-500' : 'bg-brand-gray-mid/90'}`} />
                  <span className={hasNumber ? 'text-brand-black font-medium' : 'text-brand-black/45'}>One Number</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full transition-all duration-300 ${hasSymbol ? 'bg-green-500' : 'bg-brand-gray-mid/90'}`} />
                  <span className={hasSymbol ? 'text-brand-black font-medium' : 'text-brand-black/45'}>Special Symbol</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full transition-all duration-300 ${password && passwordsMatch ? 'bg-green-500' : 'bg-brand-gray-mid/90'}`} />
                  <span className={password && passwordsMatch ? 'text-brand-black font-medium' : 'text-brand-black/45'}>Passwords Match</span>
                </div>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || (!isLogin && (!isPasswordValid || !passwordsMatch))}
            className="w-full rounded-lg bg-brand-black py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-center text-xs text-brand-black/60 border-t border-brand-gray-mid/30 pt-4 w-full">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="hover:text-brand-black underline font-medium cursor-pointer"
          >
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
}
