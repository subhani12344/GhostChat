'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CameraOff, MicOff, ShieldAlert, Video, UserPlus, UserCheck, Heart, Check, Loader2 } from 'lucide-react';
import { Socket } from 'socket.io-client';

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
  currentUser?: { username: string } | null;
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

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const isGuest = partnerUsername ? (partnerUsername.startsWith('Guest_') || partnerUsername.startsWith('Guest-')) : true;

  // Check if current user is logged in (and not a guest)
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  useEffect(() => {
    if (propCurrentUser) {
      setCurrentUser(propCurrentUser);
    } else {
      const stored = localStorage.getItem('ghostchat_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    }
  }, [propCurrentUser]);

  const isCurrentUserGuest = currentUser ? (currentUser.username.startsWith('Guest_') || currentUser.username.startsWith('Guest-') || (currentUser as any).isAnonymous) : true;
  const showFollowButton = isConnected && partnerUsername;

  const fetchRelation = async () => {
    if (!partnerUsername || isGuest || isCurrentUserGuest) return;
    setLoadingRelation(true);
    try {
      const token = localStorage.getItem('ghostchat_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${serverUrl}/api/users/${partnerUsername}/profile`, {
        headers
      });
      if (res.ok) {
        const data = await res.json();
        setRelation(data.relation || 'none');
        setIsMutual(!!data.isMutual);
      }
    } catch (err) {
      console.error('Failed to fetch relation in VideoTile:', err);
    } finally {
      setLoadingRelation(false);
    }
  };

  useEffect(() => {
    if (showFollowButton) {
      fetchRelation();
    } else {
      setRelation('none');
      setIsMutual(false);
    }
  }, [partnerUsername, isConnected, currentUser]);

  // Listen to socket follow events to stay synchronized
  useEffect(() => {
    if (!socket || !showFollowButton) return;

    const handleFollowUpdate = () => {
      fetchRelation();
    };

    socket.on('follow_update', handleFollowUpdate);
    socket.on('follow_accepted_incoming', handleFollowUpdate);
    socket.on('follow_request_incoming', handleFollowUpdate);

    return () => {
      socket.off('follow_update', handleFollowUpdate);
      socket.off('follow_accepted_incoming', handleFollowUpdate);
      socket.off('follow_request_incoming', handleFollowUpdate);
    };
  }, [socket, showFollowButton, partnerUsername]);

  const handleFollowClick = async () => {
    if (!partnerUsername || actionLoading) return;

    // 1. If current user is a guest, prompt registration/login
    if (isCurrentUserGuest) {
      setToastMessage("Please register or login to follow users!");
      if (onAuthClick) {
        onAuthClick();
      }
      return;
    }

    // 2. If partner is a guest, warn user
    if (isGuest) {
      setToastMessage("Guest users cannot be followed.");
      return;
    }

    if (!relation) return;
    setActionLoading(true);

    const token = localStorage.getItem('ghostchat_token');
    if (!token) {
      setActionLoading(false);
      return;
    }

    try {
      let endpoint = '';
      let method = 'POST';

      if (relation === 'none') {
        endpoint = '/api/follow/request';
      } else if (relation === 'incoming_pending') {
        endpoint = '/api/follow/accept';
      } else if (relation === 'accepted') {
        endpoint = '/api/follow/unfollow';
        method = 'DELETE';
      } else {
        setActionLoading(false);
        return;
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
        if (socket) {
          if (endpoint === '/api/follow/request') {
            socket.emit('follow_request', { targetUsername: partnerUsername });
          } else if (endpoint === '/api/follow/accept') {
            socket.emit('follow_accept', { targetUsername: partnerUsername });
          }
        }
        await fetchRelation();
      }
    } catch (err) {
      console.error('Follow click action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const renderFollowButton = (mode: 'video' | 'text' | 'video_header' | 'text_header') => {
    if (!showFollowButton || !relation) return null;

    const isHeader = mode.endsWith('_header');
    let btnClass = "";
    let btnText = "";
    let btnIcon = null;

    if (actionLoading || loadingRelation) {
      btnClass = isHeader
        ? "bg-white/10 text-white/50 border-white/5 cursor-not-allowed"
        : "bg-white/25 border-white/10 text-white/50 cursor-not-allowed";
      btnText = "Wait...";
      btnIcon = <Loader2 size={10} className="animate-spin" />;
    } else if (relation === 'none') {
      btnClass = isHeader
        ? mode.startsWith('video')
          ? "bg-white text-brand-black hover:bg-white/90 border-white active:scale-95"
          : "bg-brand-black text-white hover:bg-brand-black/90 border-brand-black active:scale-95"
        : mode === 'video'
          ? "bg-white text-brand-black hover:bg-white/95 border-white shadow-md active:scale-95"
          : "bg-brand-black text-white hover:bg-brand-black/90 border-brand-black active:scale-95";
      btnText = "Follow";
      btnIcon = <UserPlus size={10} />;
    } else if (relation === 'pending') {
      btnClass = mode.startsWith('video')
        ? "bg-white/10 border-white/20 text-white/40 cursor-not-allowed"
        : "bg-brand-gray-light border-brand-gray-mid/60 text-brand-black/40 cursor-not-allowed";
      btnText = "Requested";
      btnIcon = <UserCheck size={10} />;
    } else if (relation === 'incoming_pending') {
      btnClass = "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 border-emerald-600";
      btnText = "Accept";
      btnIcon = <UserCheck size={10} />;
    } else if (relation === 'accepted') {
      if (isMutual) {
        btnClass = mode.startsWith('video')
          ? "bg-white/10 border-white/20 text-white hover:bg-red-600/20 hover:text-red-400 hover:border-red-500/30 active:scale-95"
          : "bg-brand-gray-light/35 border-brand-gray-mid/60 text-brand-black hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95";
        btnText = "Mutual";
        btnIcon = <Heart size={10} className={mode.startsWith('video') ? "fill-white text-white" : "fill-brand-black text-brand-black"} />;
      } else {
        btnClass = mode.startsWith('video')
          ? "bg-white/10 border-white/20 text-white hover:bg-white/20 active:scale-95"
          : "bg-white border-brand-gray-mid/60 text-brand-black hover:bg-brand-gray-light active:scale-95";
        btnText = "Following";
        btnIcon = <Check size={10} />;
      }
    }

    const paddingClass = isHeader ? "px-2 py-1 text-[9px]" : "px-3.5 py-1.5 text-2xs";

    return (
      <button
        onClick={handleFollowClick}
        disabled={actionLoading || relation === 'pending'}
        className={`${btnClass} ${paddingClass} flex items-center gap-1 rounded-lg border font-bold uppercase tracking-wider transition-all select-none cursor-pointer`}
      >
        {btnIcon}
        {btnText}
      </button>
    );
  };

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream && chatMode === 'video') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCamOn, chatMode]);

  // Attach remote stream
  useEffect(() => {
    const video = remoteVideoRef.current;
    if (video && remoteStream && chatMode === 'video') {
      video.srcObject = remoteStream;
      video.muted = false;
      video.volume = 1.0;

      const playVideo = async () => {
        try {
          await video.play();
          console.log("Remote video/audio playing successfully.");
        } catch (err) {
          console.warn("Autoplay block detected. Attaching gesture fallback to start audio...", err);
          const playOnGesture = () => {
            video.play().then(() => {
              document.removeEventListener('click', playOnGesture);
            }).catch(e => console.error("Gesture play failed:", e));
          };
          document.addEventListener('click', playOnGesture);
        }
      };
      playVideo();
    }
  }, [remoteStream, isConnected, chatMode]);

  // Text Mode Viewport Layout: B/W minimalist graphics panel
  if (chatMode === 'text') {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-brand-gray-light border-none lg:border lg:border-brand-gray-mid/60 rounded-none lg:rounded-2xl p-6 text-center select-none overflow-hidden">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-black/80 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
            {toastMessage}
          </div>
        )}

        {/* Light-theme Instagram-Style Top Header */}
        {isConnected && (
          <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md border border-brand-gray-mid/60 pl-2 pr-3 py-1.5 text-brand-black select-none shadow-2xs">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-black text-white text-xs font-bold uppercase">
              {(partnerUsername || 'S').charAt(0)}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-2xs font-extrabold tracking-wide text-brand-black">
                {partnerUsername ? `@${partnerUsername}` : 'Stranger'}
              </span>
              {isGuest && (
                <span className="text-[8px] text-brand-black/45 leading-none">Temporary Guest</span>
              )}
            </div>
            
            <div className="border-l border-brand-gray-mid/40 pl-2 ml-1">
              {renderFollowButton('text_header')}
            </div>
          </div>
        )}

        {/* Report Button (Top Right Overlay) */}
        {isConnected && (
          <button
            onClick={onReportClick}
            className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-lg bg-black/5 hover:bg-black/10 border border-brand-gray-mid/85 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-red-500 transition-all active:scale-95"
          >
            <ShieldAlert size={12} />
            Report
          </button>
        )}

        <div className="flex flex-col items-center justify-center max-w-sm space-y-6">
          {/* Ghost Icon with floating shadow */}
          <div className={`relative flex items-center justify-center p-6 rounded-full bg-white border border-brand-gray-mid/50 ${isMatching ? 'animate-pulse' : ''} shadow-xs`}>
            <svg
              width="64"
              height="64"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-brand-black"
            >
              <path
                d="M30 46 C30 33.5 39 30 50 30 C61 30 70 33.5 70 46 V66 C70 69.5 67 70 65 68 C63 66 61 65 59 67 C57 69 55 70 53 68 C51 66 49 66 47 68 C45 70 43 69 41 67 C39 65 37 66 35 68 C33 70 30 69.5 30 66 V46 Z"
                fill="currentColor"
              />
              <circle cx="43" cy="46" r="4.5" fill="white" />
              <circle cx="57" cy="46" r="4.5" fill="white" />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold tracking-tight text-brand-black">
              {isConnected ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                  Stranger Connected
                </span>
              ) : isMatching ? (
                'Finding Text Partner...'
              ) : (
                'Text Chat Active'
              )}
            </h3>
            <p className="text-xs text-brand-black/60 leading-relaxed px-4">
              {isConnected
                ? 'Your connections are direct and secured. Start typing in the chat panel to begin.'
                : isMatching
                ? 'Looking for people matching your tags and language filters...'
                : 'Define interests below and click "Start Chatting" to instantly match in text mode.'}
            </p>
          </div>

          {isConnected && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-black/40">Active Session Info</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                <span className="rounded-md border border-brand-gray-mid/60 bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-black/65">
                  Text Mode
                </span>
                <span className="rounded-md border border-brand-gray-mid/60 bg-white px-2 py-0.5 text-[10px] font-semibold text-brand-black/65">
                  No Video / Audio
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Video Mode Viewport Layout: Local + Remote streams
  return (
    <div className="relative flex h-full w-full items-center justify-center bg-brand-black overflow-hidden rounded-none lg:rounded-2xl border-none lg:border lg:border-brand-gray-dark/50">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 rounded-xl bg-black/80 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Instagram-style Top Header */}
      {isConnected && (
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 pl-2 pr-3 py-1.5 text-white select-none">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold uppercase border border-white/10 text-white">
            {(partnerUsername || 'S').charAt(0)}
          </div>
          <div className="flex flex-col text-left">
            <span className="text-2xs font-extrabold tracking-wide text-white/90">
              {partnerUsername ? `@${partnerUsername}` : 'Stranger'}
            </span>
            {isGuest && (
              <span className="text-[8px] text-white/40 leading-none">Temporary Guest</span>
            )}
          </div>
          
          <div className="border-l border-white/15 pl-2 ml-1">
            {renderFollowButton('video_header')}
          </div>
        </div>
      )}

      {/* 1. STRANGER / REMOTE VIDEO TILE */}
      <div className="absolute inset-0 flex h-full w-full items-center justify-center">
        {isConnected && remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="video-fit transition-all duration-300"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-4 px-6 select-none animate-pulse-soft">
            {/* Minimalist Ghost graphic in center */}
            <svg
              width="64"
              height="64"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-white/30"
            >
              <path
                d="M30 46 C30 33.5 39 30 50 30 C61 30 70 33.5 70 46 V66 C70 69.5 67 70 65 68 C63 66 61 65 59 67 C57 69 55 70 53 68 C51 66 49 66 47 68 C45 70 43 69 41 67 C39 65 37 66 35 68 C33 70 30 69.5 30 66 V46 Z"
                fill="currentColor"
              />
              <circle cx="43" cy="46" r="4.5" fill="black" fillOpacity="0.4" />
              <circle cx="57" cy="46" r="4.5" fill="black" fillOpacity="0.4" />
            </svg>
            <div className="space-y-1">
              <h4 className="text-sm font-bold tracking-wide text-white/70">
                {isMatching ? 'Matching Queue Active...' : 'Looking for a match...'}
              </h4>
              <p className="text-xs text-white/40 max-w-[200px] leading-relaxed">
                {isMatching ? 'Finding a matching peer with your filters.' : 'Click start to search for connections.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. LOCAL USER PIP PREVIEW */}
      <div className="absolute right-4 top-4 z-20 h-28 w-20 overflow-hidden rounded-xl border border-white/20 bg-brand-gray-dark/80 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:top-auto sm:h-36 sm:w-28 transition-all duration-300">
        {isCamOn && localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-center p-2 text-white/50 space-y-1">
            <CameraOff size={16} />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">Muted</span>
          </div>
        )}
        
        {/* Indicators overlay */}
        <div className="absolute bottom-1.5 left-1.5 flex gap-1 z-30">
          {!isMicOn && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600/90 text-white p-0.5">
              <MicOff size={10} />
            </span>
          )}
        </div>
      </div>

      {/* 3. REPORT STRANGER BUTTON (Moved to Bottom Left to prevent header overlap) */}
      {isConnected && (
        <button
          onClick={onReportClick}
          className="absolute left-4 bottom-4 z-20 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-red-500 transition-all hover:bg-red-600 hover:text-white"
        >
          <ShieldAlert size={12} />
          Report
        </button>
      )}
    </div>
  );
}
