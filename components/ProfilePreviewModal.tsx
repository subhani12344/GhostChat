'use client';

import React, { useState, useEffect } from 'react';
import { X, Video, MessageSquare, UserPlus, UserCheck, Users, Heart, MapPin, Loader2 } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

interface ProfilePreviewModalProps {
  username: string;
  serverUrl: string;
  socket?: Socket | null;
  onClose: () => void;
}

interface Profile {
  username: string;
  nickname?: string;
  bio?: string;
  profile_img?: string;
  followersCount?: number;
  followingCount?: number;
  relation?: string;
  isMutual?: boolean;
}

export default function ProfilePreviewModal({ username, serverUrl, socket, onClose }: ProfilePreviewModalProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('ghostchat_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`${serverUrl}/api/users/${username}/profile`, { headers });
        if (res.ok) {
          const data: Profile = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error('Failed to fetch profile preview:', err);
      } finally {
        setLoading(false);
      }
    };
    if (username) fetchProfile();
  }, [username, serverUrl]);

  const handleFollowAction = async () => {
    if (!profile || actionLoading) return;
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;
    setActionLoading(true);
    try {
      let endpoint = `${serverUrl}/api/follow/request`;
      if (profile.relation === 'accepted') endpoint = `${serverUrl}/api/follow/unfollow`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUsername: username })
      });
      if (res.ok) {
        if (profile.relation === 'accepted') {
          setProfile(prev => prev ? { ...prev, relation: 'none', followersCount: Math.max(0, (prev.followersCount ?? 0) - 1) } : prev);
        } else {
          setProfile(prev => prev ? { ...prev, relation: 'pending' } : prev);
          // Signal socket
          socket?.emit('follow_request', { targetUsername: username });
        }
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const startChat = (mode: 'video' | 'text') => {
    // Invite this user to a private call
    socket?.emit('private_invite', { targetUsername: username });
    router.push(`/chat?mode=${mode}`);
    onClose();
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const displayName = profile?.nickname || profile?.username || username;
  const initial = displayName.charAt(0).toUpperCase();
  const isMutual = profile?.relation === 'accepted' && profile?.isMutual;

  const followLabel = () => {
    if (profile?.relation === 'accepted') return 'Unfollow';
    if (profile?.relation === 'pending') return 'Requested';
    if (profile?.relation === 'incoming_pending') return 'Follow Back';
    return 'Follow';
  };

  const followIcon = () => {
    if (profile?.relation === 'accepted') return <UserCheck size={13} />;
    return <UserPlus size={13} />;
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Card */}
      <div className={`relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
      }`}>
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-gray-100 text-gray-400 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : (
          <>
            {/* Hero section */}
            <div className="relative h-28 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
              {/* Decorative circles */}
              <div className="absolute top-4 left-6 h-16 w-16 rounded-full bg-white/5" />
              <div className="absolute bottom-0 right-8 h-24 w-24 rounded-full bg-white/5" />
            </div>

            {/* Avatar — overlaps hero */}
            <div className="relative px-6">
              <div className="-mt-10 mb-3 flex items-end justify-between">
                <div className="shrink-0">
                  {profile?.profile_img ? (
                    <img
                      src={profile.profile_img}
                      alt={displayName}
                      className="h-20 w-20 rounded-2xl object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-900 to-gray-700 text-white text-3xl font-black border-4 border-white shadow-lg">
                      {initial}
                    </div>
                  )}
                </div>

                {/* Follow button */}
                <button
                  onClick={handleFollowAction}
                  disabled={actionLoading || profile?.relation === 'pending'}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-60 cursor-pointer shadow-sm ${
                    profile?.relation === 'accepted'
                      ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      : profile?.relation === 'pending'
                      ? 'border border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {actionLoading
                    ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                    : followIcon()
                  }
                  {followLabel()}
                </button>
              </div>

              {/* Name + username */}
              <div className="mb-4 space-y-0.5">
                <h3 className="font-black text-gray-900 text-lg leading-tight">{displayName}</h3>
                <p className="text-xs text-gray-400 font-medium">@{profile?.username || username}</p>
                {profile?.bio && (
                  <p className="text-xs text-gray-600 leading-relaxed pt-1">{profile.bio}</p>
                )}
              </div>

              {/* Stats row */}
              <div className="mb-5 flex items-center gap-4 rounded-2xl bg-gray-50 p-3.5 border border-gray-100">
                <div className="flex flex-col items-center gap-0.5 flex-1">
                  <div className="flex items-center gap-1">
                    <Users size={11} className="text-gray-400" />
                    <span className="font-black text-gray-900 text-sm">{profile?.followersCount ?? 0}</span>
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Followers</span>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="flex flex-col items-center gap-0.5 flex-1">
                  <div className="flex items-center gap-1">
                    <Heart size={11} className="text-gray-400" />
                    <span className="font-black text-gray-900 text-sm">{profile?.followingCount ?? 0}</span>
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">Following</span>
                </div>
                <div className="h-8 w-px bg-gray-200" />
                <div className="flex flex-col items-center gap-0.5 flex-1">
                  <div className={`h-2.5 w-2.5 rounded-full ${isMutual ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400">{isMutual ? 'Mutual' : 'Not Mutual'}</span>
                </div>
              </div>

              {/* Video/Text Chat — only for mutual followers */}
              {isMutual ? (
                <div className="mb-6 flex gap-3">
                  <button
                    onClick={() => startChat('video')}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800 active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    <Video size={13} />
                    Video Chat
                  </button>
                  <button
                    onClick={() => startChat('text')}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-gray-200 py-3 text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
                  >
                    <MessageSquare size={13} />
                    Text Chat
                  </button>
                </div>
              ) : (
                <div className="mb-6 rounded-xl bg-gray-50 border border-gray-100 p-3 text-center">
                  <p className="text-[10px] text-gray-400 leading-relaxed">
                    Video & Text Chat are available only for <span className="font-bold text-gray-600">mutual followers</span>.
                    {profile?.relation !== 'accepted' && ' Follow this user first.'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
