'use client';

import React, { useState, useEffect } from 'react';
import { UserPlus, UserCheck, ShieldAlert, X, Heart } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface PeerProfileCardProps {
  partnerUsername: string;
  serverUrl: string;
  socket: Socket | null;
  onClose?: () => void;
}

export default function PeerProfileCard({ partnerUsername, serverUrl, socket, onClose }: PeerProfileCardProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch peer profile data
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('ghostchat_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${serverUrl}/api/users/${partnerUsername}/profile`, {
        method: 'GET',
        headers
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to fetch matched peer profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (partnerUsername) {
      fetchProfile();
    }
  }, [partnerUsername, serverUrl]);

  // Listen for socket follow updates mid-conversation
  useEffect(() => {
    if (!socket) return;

    const handleFollowUpdate = () => {
      fetchProfile();
    };

    socket.on('follow_update', handleFollowUpdate);
    socket.on('follow_accepted_incoming', handleFollowUpdate);
    socket.on('follow_request_incoming', handleFollowUpdate);

    return () => {
      socket.off('follow_update', handleFollowUpdate);
      socket.off('follow_accepted_incoming', handleFollowUpdate);
      socket.off('follow_request_incoming', handleFollowUpdate);
    };
  }, [socket]);

  const handleFollowAction = async () => {
    if (!profile || actionLoading) return;
    setActionLoading(true);

    const token = localStorage.getItem('ghostchat_token');
    if (!token) {
      setActionLoading(false);
      return;
    }

    try {
      let endpoint = '';
      let method = 'POST';

      if (profile.relation === 'none') {
        endpoint = '/api/follow/request';
      } else if (profile.relation === 'incoming_pending') {
        endpoint = '/api/follow/accept';
      } else if (profile.relation === 'accepted') {
        endpoint = '/api/follow/unfollow';
        method = 'DELETE';
      } else {
        setActionLoading(false);
        return; // pending request / requested cannot do anything
      }

      const res = await fetch(`${serverUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername: partnerUsername })
      });

      if (res.ok) {
        // Emit Socket Event for instant peer update
        if (socket) {
          if (endpoint === '/api/follow/request') {
            socket.emit('follow_request', { targetUsername: partnerUsername });
          } else if (endpoint === '/api/follow/accept') {
            socket.emit('follow_accept', { targetUsername: partnerUsername });
          }
        }
        await fetchProfile();
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-72 flex-col items-center justify-center bg-white/95 border-l border-brand-gray-mid/30 p-6 backdrop-blur-sm animate-in slide-in-from-right duration-200">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-black border-t-transparent" />
        <span className="text-[10px] uppercase font-bold tracking-wider text-brand-black/40 mt-3">Loading profile...</span>
      </div>
    );
  }

  if (!profile) return null;

  const isGuest = partnerUsername.startsWith('Guest_');

  return (
    <div className="relative flex h-full w-72 flex-col bg-white border-l border-brand-gray-mid/30 p-6 shadow-2xl animate-in slide-in-from-right duration-200 overflow-y-auto">
      {onClose && (
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-brand-black/40 hover:text-brand-black transition-colors"
        >
          <X size={18} />
        </button>
      )}

      {/* Profile Info */}
      <div className="flex flex-col items-center text-center space-y-4 mt-6">
        {/* Avatar */}
        {profile.profile_img ? (
          <img 
            src={profile.profile_img} 
            alt={profile.username} 
            className="h-20 w-20 rounded-2xl object-cover border-2 border-brand-black/10 shadow-sm"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-black text-white text-3xl font-extrabold shadow-md border-2 border-brand-black/10">
            {profile.username.charAt(0).toUpperCase()}
          </div>
        )}

        {/* User Titles */}
        <div>
          <h4 className="font-extrabold text-brand-black text-base leading-tight">
            {profile.nickname || profile.username}
          </h4>
          <span className="text-xs text-brand-black/55">@{profile.username}</span>
        </div>

        {/* Follower metrics */}
        {!isGuest && (
          <div className="grid grid-cols-2 gap-6 w-full border-y border-brand-gray-light py-3">
            <div className="text-center">
              <span className="block text-sm font-extrabold text-brand-black leading-none">{profile.followersCount}</span>
              <span className="text-[10px] font-bold text-brand-black/40 uppercase tracking-wider mt-1 block">Followers</span>
            </div>
            <div className="text-center">
              <span className="block text-sm font-extrabold text-brand-black leading-none">{profile.followingCount}</span>
              <span className="text-[10px] font-bold text-brand-black/40 uppercase tracking-wider mt-1 block">Following</span>
            </div>
          </div>
        )}

        {/* Bio */}
        <div className="w-full text-left bg-brand-gray-light/35 rounded-xl p-3.5 border border-brand-gray-mid/20">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-black/40 mb-1">About</span>
          <p className="text-xs text-brand-black/80 leading-relaxed whitespace-pre-wrap">
            {isGuest ? 'This user is chatting anonymously as a guest. Profiles are only available to registered members.' : (profile.bio || 'No bio written yet.')}
          </p>
        </div>

        {/* Follow Actions */}
        {!isGuest && (
          <div className="w-full pt-2">
            {profile.relation === 'none' && (
              <button
                onClick={handleFollowAction}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-black py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 disabled:opacity-50"
              >
                <UserPlus size={14} />
                Follow User
              </button>
            )}

            {profile.relation === 'pending' && (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-brand-gray-mid/70 bg-brand-gray-light py-3 text-xs font-bold uppercase tracking-wider text-brand-black/40 cursor-not-allowed"
              >
                Requested
              </button>
            )}

            {profile.relation === 'incoming_pending' && (
              <button
                onClick={handleFollowAction}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
              >
                <UserCheck size={14} />
                Accept Follow
              </button>
            )}

            {profile.relation === 'accepted' && (
              <button
                onClick={handleFollowAction}
                disabled={actionLoading}
                className={`w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 ${
                  profile.isMutual 
                    ? 'border-brand-black bg-brand-gray-light/20 text-brand-black hover:bg-red-50 hover:text-red-600 hover:border-red-200' 
                    : 'border-brand-gray-mid/60 bg-white text-brand-black hover:bg-brand-gray-light'
                }`}
              >
                {profile.isMutual ? (
                  <>
                    <Heart size={14} className="fill-brand-black text-brand-black group-hover:fill-transparent" />
                    Mutual Follow
                  </>
                ) : (
                  <>
                    <UserCheck size={14} />
                    Following
                  </>
                )}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
