'use client';

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Users, Heart } from 'lucide-react';

interface FollowRequestPopupProps {
  senderUsername: string;
  serverUrl: string;
  onAccept: () => void;
  onDecline: () => void;
}

interface SenderProfile {
  username: string;
  nickname?: string;
  bio?: string;
  profile_img?: string;
  followersCount?: number;
  followingCount?: number;
}

export default function FollowRequestPopup({ senderUsername, serverUrl, onAccept, onDecline }: FollowRequestPopupProps) {
  const [profile, setProfile] = useState<SenderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('ghostchat_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${serverUrl}/api/users/${senderUsername}/profile`, { headers });
        if (res.ok) {
          const data: SenderProfile = await res.json();
          setProfile(data);
        } else {
          setProfile({ username: senderUsername });
        }
      } catch {
        setProfile({ username: senderUsername });
      } finally {
        setLoading(false);
      }
    };
    if (senderUsername) fetchProfile();
  }, [senderUsername, serverUrl]);

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept();
  };

  const handleDecline = async () => {
    setDeclining(true);
    await onDecline();
  };

  const displayName = profile?.nickname || profile?.username || senderUsername;
  const initial = (displayName).charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleDecline}
      />

      {/* Card */}
      <div className={`relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-400 ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
      }`}>
        {/* Top gradient accent */}
        <div className="h-1 w-full bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-3 py-1">
              <UserPlus size={11} className="text-blue-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Follow Request</span>
            </div>
            <button onClick={handleDecline} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer">
              <X size={14} />
            </button>
          </div>

          {/* Profile Section */}
          {loading ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="h-16 w-16 rounded-2xl bg-gray-100 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
                <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
                <div className="h-3 bg-gray-100 rounded-lg w-full" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                {profile?.profile_img ? (
                  <img
                    src={profile.profile_img}
                    alt={displayName}
                    className="h-16 w-16 rounded-2xl object-cover border-2 border-gray-100 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 text-white text-2xl font-black shadow-sm shrink-0">
                    {initial}
                  </div>
                )}

                {/* Name + Username */}
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-gray-900 text-base leading-tight truncate">{displayName}</h4>
                  <span className="text-[11px] text-gray-400 font-medium">@{profile?.username || senderUsername}</span>

                  {/* Stats */}
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <Users size={10} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-700">{profile?.followersCount ?? 0}</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide">followers</span>
                    </div>
                    <div className="h-2.5 w-px bg-gray-200" />
                    <div className="flex items-center gap-1">
                      <Heart size={10} className="text-gray-400" />
                      <span className="text-[10px] font-bold text-gray-700">{profile?.followingCount ?? 0}</span>
                      <span className="text-[9px] text-gray-400 uppercase tracking-wide">following</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {profile?.bio && (
                <p className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {profile.bio}
                </p>
              )}

              {/* Request message */}
              <p className="text-sm font-semibold text-gray-800 text-center">
                <span className="text-gray-900 font-black">@{profile?.username || senderUsername}</span> wants to follow you.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              disabled={accepting || declining}
              className="flex-1 rounded-2xl bg-gray-900 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800 active:scale-95 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              {accepting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Accepting...
                </span>
              ) : 'Accept'}
            </button>
            <button
              onClick={handleDecline}
              disabled={accepting || declining}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {declining ? 'Declining...' : 'Decline'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
