'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { CameraOff, MicOff, ShieldAlert, UserPlus, UserCheck, Heart, Check, Loader2 } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface CurrentUser {
  username: string;
  isAnonymous?: boolean;
}

interface VideoTileProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCamOn: boolean;
  isMicOn: boolean;
  isConnected: boolean;
  isMatching: boolean;
  onReportClick: () => void;
  onAuthClick?: (() => void) | null;
  chatMode?: 'video' | 'text';
  partnerUsername?: string | null;
  serverUrl?: string;
  socket?: Socket | null;
  currentUser?: CurrentUser | null;
}

export default function VideoTile({
  localStream,
  remoteStream,
  isCamOn,
  isMicOn,
  isConnected,
  isMatching,
  onReportClick,
  onAuthClick = null,
  chatMode = 'video',
  partnerUsername = null,
  serverUrl = 'http://localhost:4000',
  socket = null,
  currentUser: propCurrentUser = null
}: VideoTileProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [relation, setRelation] = useState<'none' | 'pending' | 'incoming_pending' | 'accepted' | null>('none');
  const [isMutual, setIsMutual] = useState(false);
  const [loadingRelation, setLoadingRelation] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentUser = useMemo<CurrentUser | null>(() => {
    if (propCurrentUser) return propCurrentUser;
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('ghostchat_user');
      if (stored) return JSON.parse(stored) as CurrentUser;
    } catch { /* ignore */ }
    return null;
  }, [propCurrentUser]);

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const isPartnerGuest = partnerUsername
    ? (partnerUsername.startsWith('Guest_') || partnerUsername.startsWith('Guest-'))
    : true;

  const isCurrentUserGuest = currentUser
    ? (currentUser.username.startsWith('Guest_') || currentUser.username.startsWith('Guest-') || !!currentUser.isAnonymous)
    : true;

  const showFollowButton = isConnected && partnerUsername;

  const fetchRelation = useCallback(async () => {
    if (!partnerUsername || isPartnerGuest || isCurrentUserGuest) return;
    setLoadingRelation(true);
    try {
      const token = localStorage.getItem('ghostchat_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${serverUrl}/api/users/${partnerUsername}/profile`, { headers });
      if (res.ok) {
        const data = (await res.json()) as { relation?: string; isMutual?: boolean };
        setRelation((data.relation as typeof relation) || 'none');
        setIsMutual(!!data.isMutual);
      }
    } catch (err) {
      console.error('Failed to fetch relation in VideoTile:', err);
    } finally {
      setLoadingRelation(false);
    }
  }, [partnerUsername, isPartnerGuest, isCurrentUserGuest, serverUrl]);

  useEffect(() => {
    if (showFollowButton) fetchRelation();
    else { setRelation('none'); setIsMutual(false); }
  }, [partnerUsername, isConnected, fetchRelation, showFollowButton]);

  useEffect(() => {
    if (!socket || !showFollowButton) return;
    const refresh = () => { fetchRelation(); };
    socket.on('follow_update', refresh);
    socket.on('follow_accepted_incoming', refresh);
    socket.on('follow_request_incoming', refresh);
    return () => {
      socket.off('follow_update', refresh);
      socket.off('follow_accepted_incoming', refresh);
      socket.off('follow_request_incoming', refresh);
    };
  }, [socket, showFollowButton, fetchRelation]);

  const handleFollowClick = async () => {
    if (!partnerUsername || actionLoading) return;

    if (isCurrentUserGuest) {
      setToastMessage('Create an account to follow users!');
      if (onAuthClick) onAuthClick();
      return;
    }
    if (isPartnerGuest) {
      setToastMessage('Guest users cannot be followed.');
      return;
    }
    if (!relation) return;

    setActionLoading(true);
    const token = localStorage.getItem('ghostchat_token');
    if (!token) { setActionLoading(false); return; }

    try {
      let endpoint = '';
      let method = 'POST';
      if (relation === 'none') endpoint = '/api/follow/request';
      else if (relation === 'incoming_pending') endpoint = '/api/follow/accept';
      else if (relation === 'accepted') { endpoint = '/api/follow/unfollow'; method = 'DELETE'; }
      else { setActionLoading(false); return; }

      const res = await fetch(`${serverUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUsername: partnerUsername })
      });

      if (res.ok) {
        if (socket) {
          if (endpoint === '/api/follow/request') socket.emit('follow_request', { targetUsername: partnerUsername });
          else if (endpoint === '/api/follow/accept') socket.emit('follow_accept', { targetUsername: partnerUsername });
        }
        if (relation === 'none') setToastMessage(`Follow request sent to @${partnerUsername}!`);
        else if (relation === 'incoming_pending') setToastMessage(`You are now following @${partnerUsername}!`);
        await fetchRelation();
      }
    } catch (err) {
      console.error('Follow click action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Attach local stream
  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (videoEl && localStream && chatMode === 'video') {
      videoEl.srcObject = localStream;
      videoEl.play().catch(() => {});
    }
  }, [localStream, isCamOn, chatMode]);

  // Attach remote stream
  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (videoEl && remoteStream && chatMode === 'video') {
      videoEl.srcObject = remoteStream;
      videoEl.play().catch(() => {});
    }
  }, [remoteStream, isConnected, chatMode]);

  // ─── Follow Button renderer ───────────────────────────────────────────────
  const renderFollowButton = () => {
    if (!showFollowButton) return null;

    let label = '';
    let icon = null;
    let btnClass = '';

    if (actionLoading || loadingRelation) {
      label = '…';
      icon = <Loader2 size={12} className="animate-spin" />;
      btnClass = 'bg-white/10 text-white/40 border-white/10 cursor-not-allowed';
    } else if (relation === 'none') {
      label = 'Follow';
      icon = <UserPlus size={12} />;
      btnClass = 'bg-white text-gray-900 border-white hover:bg-white/90 active:scale-95 shadow-sm';
    } else if (relation === 'pending') {
      label = 'Requested';
      icon = <UserCheck size={12} />;
      btnClass = 'bg-white/10 text-white/50 border-white/15 cursor-not-allowed';
    } else if (relation === 'incoming_pending') {
      label = 'Accept';
      icon = <UserCheck size={12} />;
      btnClass = 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600 active:scale-95 shadow-sm';
    } else if (relation === 'accepted') {
      if (isMutual) {
        label = 'Mutual';
        icon = <Heart size={12} className="fill-white text-white" />;
        btnClass = 'bg-pink-500/20 text-pink-300 border-pink-500/30 hover:bg-red-600/20 hover:text-red-300 active:scale-95';
      } else {
        label = 'Following';
        icon = <Check size={12} />;
        btnClass = 'bg-white/10 text-white border-white/20 hover:bg-white/20 active:scale-95';
      }
    }

    return (
      <button
        onClick={handleFollowClick}
        disabled={actionLoading || loadingRelation || relation === 'pending'}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all select-none cursor-pointer ${btnClass}`}
      >
        {icon}{label}
      </button>
    );
  };

  // ─── Text Mode ────────────────────────────────────────────────────────────
  if (chatMode === 'text') {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-gray-50 border-none lg:border lg:border-gray-200 rounded-none lg:rounded-2xl p-6 text-center select-none overflow-hidden">
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-gray-900/90 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200 whitespace-nowrap">
            {toastMessage}
          </div>
        )}

        {/* Top header when connected */}
        {isConnected && (
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-white border border-gray-200 shadow-sm pl-2 pr-3 py-1.5 select-none">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white text-xs font-bold uppercase">
              {(partnerUsername || 'S').charAt(0)}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-bold tracking-wide text-gray-900">
                {partnerUsername ? `@${partnerUsername}` : 'Stranger'}
              </span>
              {isPartnerGuest && <span className="text-[9px] text-gray-400 leading-none">Guest</span>}
            </div>
            <div className="border-l border-gray-200 pl-2 ml-0.5">
              {renderFollowButton()}
            </div>
          </div>
        )}

        {isConnected && (
          <button onClick={onReportClick}
            className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-red-500 transition-all active:scale-95 hover:bg-red-50 shadow-sm">
            <ShieldAlert size={12} /> Report
          </button>
        )}

        <div className="flex flex-col items-center justify-center max-w-sm space-y-5">
          <div className={`relative flex items-center justify-center p-5 rounded-full bg-white border border-gray-200 shadow-sm ${isMatching ? 'animate-pulse' : ''}`}>
            <svg width="56" height="56" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-gray-900">
              <path d="M30 46 C30 33.5 39 30 50 30 C61 30 70 33.5 70 46 V66 C70 69.5 67 70 65 68 C63 66 61 65 59 67 C57 69 55 70 53 68 C51 66 49 66 47 68 C45 70 43 69 41 67 C39 65 37 66 35 68 C33 70 30 69.5 30 66 V46 Z" fill="currentColor" />
              <circle cx="43" cy="46" r="4.5" fill="white" />
              <circle cx="57" cy="46" r="4.5" fill="white" />
            </svg>
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-gray-900">
              {isConnected ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Stranger Connected
                </span>
              ) : isMatching ? 'Finding Text Partner...' : 'Text Chat Ready'}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed px-4">
              {isConnected
                ? 'Start typing in the chat panel to begin.'
                : isMatching
                ? 'Looking for someone matching your preferences...'
                : 'Click "Start Chatting" to find an anonymous text partner.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Video Mode ───────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[#0a0a0a] overflow-hidden rounded-none lg:rounded-2xl">

      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-black/80 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200 whitespace-nowrap">
          {toastMessage}
        </div>
      )}

      {/* Remote video (full screen) */}
      <div className="absolute inset-0 flex h-full w-full items-center justify-center">
        {isConnected && remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-4 px-6 select-none">
            <div className={`transition-opacity duration-500 ${isMatching ? 'opacity-60' : 'opacity-30'}`}>
              <svg width="56" height="56" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white mx-auto">
                <path d="M30 46 C30 33.5 39 30 50 30 C61 30 70 33.5 70 46 V66 C70 69.5 67 70 65 68 C63 66 61 65 59 67 C57 69 55 70 53 68 C51 66 49 66 47 68 C45 70 43 69 41 67 C39 65 37 66 35 68 C33 70 30 69.5 30 66 V46 Z" fill="currentColor" />
                <circle cx="43" cy="46" r="4.5" fill="black" fillOpacity="0.5" />
                <circle cx="57" cy="46" r="4.5" fill="black" fillOpacity="0.5" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white/60">
                {isMatching ? 'Finding a match...' : 'Waiting for partner'}
              </p>
              <p className="text-xs text-white/30 max-w-[180px] leading-relaxed">
                {isMatching ? 'Searching with your preferences.' : 'Press Start Chatting to begin.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── TOP BAR: Partner info + Follow + Report ── */}
      {isConnected && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4 pb-8 bg-gradient-to-b from-black/60 to-transparent">
          {/* Left: Partner identity */}
          <div className="flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 pl-2 pr-3 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white border border-white/10">
              {(partnerUsername || 'S').charAt(0)}
            </div>
            <div className="flex flex-col text-left leading-tight">
              <span className="text-[11px] font-bold text-white/90">
                {partnerUsername ? `@${partnerUsername}` : 'Stranger'}
              </span>
              {isPartnerGuest && <span className="text-[8px] text-white/40">Temporary Guest</span>}
            </div>
          </div>

          {/* Right: Follow + Report */}
          <div className="flex items-center gap-2">
            {renderFollowButton()}
            <button onClick={onReportClick}
              className="flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-red-400 hover:bg-red-600/30 hover:text-red-300 transition-all active:scale-95">
              <ShieldAlert size={11} /> Report
            </button>
          </div>
        </div>
      )}

      {/* ── LOCAL PiP (self-view bottom-right) ── */}
      <div className="absolute right-3 bottom-20 z-20 h-28 w-20 overflow-hidden rounded-xl border border-white/15 bg-gray-900 shadow-lg sm:h-32 sm:w-24 transition-all duration-300">
        {isCamOn && localStream ? (
          <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover transform -scale-x-100" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-white/40 space-y-1 p-2">
            <CameraOff size={16} />
            <span className="text-[8px] font-semibold uppercase text-white/30">Camera Off</span>
          </div>
        )}
        {!isMicOn && (
          <div className="absolute bottom-1.5 left-1.5 z-30">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600/90 text-white p-0.5">
              <MicOff size={10} />
            </span>
          </div>
        )}
        {/* "You" label */}
        <div className="absolute top-1.5 left-1.5 z-30">
          <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[8px] font-bold text-white/70 uppercase tracking-wider">You</span>
        </div>
      </div>
    </div>
  );
}
