'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Heart, X } from 'lucide-react';

interface FollowBackPopupProps {
  targetUsername: string;
  serverUrl: string;
  onFollowBack: () => void;
  onSkip: () => void;
}

const COUNTDOWN_SECONDS = 15;

export default function FollowBackPopup({ targetUsername, serverUrl, onFollowBack, onSkip }: FollowBackPopupProps) {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Fetch the target's avatar
    const fetchAvatar = async () => {
      try {
        const token = localStorage.getItem('ghostchat_token');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${serverUrl}/api/users/${targetUsername}/profile`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAvatar(data.profile_img || null);
        }
      } catch { /* ignore */ }
    };
    fetchAvatar();
  }, [targetUsername, serverUrl]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [onSkip]);

  const handleFollowBack = async () => {
    clearInterval(timerRef.current!);
    setLoading(true);
    await onFollowBack();
  };

  const handleSkip = () => {
    clearInterval(timerRef.current!);
    onSkip();
  };

  const progress = (countdown / COUNTDOWN_SECONDS) * 100;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress / 100);
  const initial = targetUsername.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center p-4 sm:p-6">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleSkip}
      />

      <div className={`relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-400 ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
      }`}>
        {/* Gradient top */}
        <div className="h-1 w-full bg-gradient-to-r from-pink-500 via-rose-400 to-pink-500" />

        <div className="p-6 space-y-5">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 rounded-full bg-pink-50 border border-pink-100 px-3 py-1">
              <Heart size={11} className="text-pink-500 fill-pink-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-pink-600">Follow Back?</span>
            </div>

            {/* Countdown ring */}
            <div className="relative flex items-center justify-center cursor-pointer" onClick={handleSkip} title="Auto-dismisses">
              <svg width="40" height="40" className="-rotate-90">
                <circle cx="20" cy="20" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="3" />
                <circle
                  cx="20" cy="20" r={radius}
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-gray-600">{countdown}</span>
            </div>
          </div>

          {/* Profile block */}
          <div className="flex flex-col items-center gap-3 text-center py-2">
            {avatar ? (
              <img src={avatar} alt={targetUsername} className="h-20 w-20 rounded-2xl object-cover border-2 border-gray-100 shadow-sm" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white text-3xl font-black shadow-sm">
                {initial}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-600 leading-relaxed">
                Would you like to follow{' '}
                <span className="font-black text-gray-900">@{targetUsername}</span>
                {' '}back?
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">They are now following you.</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleFollowBack}
              disabled={loading}
              className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-xs font-bold uppercase tracking-wider text-white hover:from-pink-600 hover:to-rose-600 active:scale-95 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Following...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Heart size={12} className="fill-white" />
                  Follow Back
                </span>
              )}
            </button>
            <button
              onClick={handleSkip}
              disabled={loading}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
