'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import VideoTile from './VideoTile';
import ChatPanel from './ChatPanel';
import MatchingFilters from './MatchingFilters';
import ReportModal from './ReportModal';
import TermsModal from './TermsModal';
import PeerProfileCard from './PeerProfileCard';
import AuthModal from './AuthModal';
import Navbar from './Navbar';
import FollowRequestPopup from './FollowRequestPopup';
import FollowBackPopup from './FollowBackPopup';
import { useProfileSync, ProfileData } from '../hooks/useProfileSync';
import { Video, MessageSquare, Volume2, VideoOff, MicOff, RefreshCw, Square, UserCheck, PhoneCall } from 'lucide-react';

interface Message {
  id: string;
  sender: 'self' | 'stranger' | 'system';
  text: string;
  timestamp: string;
}

interface CurrentUser {
  username: string;
  isAnonymous?: boolean;
  token?: string;
}

interface VideoRoomProps {
  serverUrl: string;
  chatMode: 'video' | 'text';
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// Read user from localStorage without causing useEffect state-set cascade
function readStoredUser(): CurrentUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('ghostchat_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.username) return parsed as CurrentUser;
    }
  } catch (_) {}
  return null;
}

function readTermsAccepted(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('ghostchat_terms_accepted') === 'true';
}

export default function VideoRoom({ serverUrl, chatMode }: VideoRoomProps) {
  const router = useRouter();

  // Initialise directly from localStorage — no synchronous setState in effects
  const [showTerms, setShowTerms] = useState<boolean>(() => !readTermsAccepted());
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => readStoredUser());
  const [username, setUsername] = useState<string>(() => readStoredUser()?.username ?? '');

  const [showMobileChat, setShowMobileChat] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  // Socket & WebRTC refs
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null); // state copy to safely pass to children during render
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Filter preferences (text mode only)
  const [interests, setInterests] = useState<string[]>([]);
  const [language, setLanguage] = useState('all');
  const [country, setCountry] = useState('all');

  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCamOn, setIsCamOn] = useState(chatMode === 'video');
  const [isMicOn, setIsMicOn] = useState(true);

  // Connection & Chat states
  const [isConnected, setIsConnected] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [partnerUsername, setPartnerUsername] = useState<string | null>(null);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isOfflineSim, setIsOfflineSim] = useState(false);
  const [incomingFollowRequest, setIncomingFollowRequest] = useState<string | null>(null);
  const [followBackTarget, setFollowBackTarget] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<{ senderUsername: string; roomId: string } | null>(null);

  // Viewport Resize Adjustments
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        containerRef.current.style.height = `${window.innerHeight}px`;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Redirect if not logged in (read synchronously, redirect is a side-effect)
  useEffect(() => {
    const token = localStorage.getItem('ghostchat_token');
    const stored = localStorage.getItem('ghostchat_user');
    if (!token || !stored) {
      router.push('/');
    }
  }, [router]);

  useProfileSync(
    socket,
    useCallback((data: ProfileData) => {
      if (currentUser && currentUser.username === data.username) {
        const updated = { ...currentUser, ...data };
        setCurrentUser(updated);
        localStorage.setItem('ghostchat_user', JSON.stringify(updated));
      }
    }, [currentUser]),
    useCallback((data: ProfileData) => {
      // Peer updates are handled by PeerProfileCard directly
    }, [])
  );

  // ─── Stable helpers via useRef so they can safely be called inside effects ───
  const appendMessageRef = useRef<(sender: 'self' | 'stranger' | 'system', text: string) => void>(undefined);
  const appendMessage = useCallback((sender: 'self' | 'stranger' | 'system', text: string) => {
    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      { id: Math.random().toString(36).substr(2), sender, text, timestamp: formattedTime }
    ]);
  }, []);
  appendMessageRef.current = appendMessage;

  const appendSystemMessage = useCallback((text: string) => {
    appendMessageRef.current?.('system', text);
  }, []);

  const stopLocalTracksRef = useRef<() => void>(undefined);
  const stopLocalTracks = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  }, []);
  stopLocalTracksRef.current = stopLocalTracks;

  const cleanPeerConnectionRef = useRef<() => void>(undefined);
  const cleanPeerConnection = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    setRemoteStream(null);
    setPartnerUsername(null);
  }, []);
  cleanPeerConnectionRef.current = cleanPeerConnection;

  // ─── Initialize Media ────────────────────────────────────────────────────
  useEffect(() => {
    async function initMedia() {
      if (chatMode === 'text') return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: true
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        console.warn('Camera/mic denied. Creating canvas fallback stream.');
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        const intervalId = setInterval(() => {
          if (ctx) {
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Camera Unavailable', 320, 230);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillText('Allow camera access to share your video', 320, 260);
          }
        }, 200);

        try {
          const canvasAny = canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream };
          const dummyVideoTrack = canvasAny.captureStream(5).getVideoTracks()[0];
          const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            const audioContext = new AudioCtx();
            const oscillator = audioContext.createOscillator();
            const dst = audioContext.createMediaStreamDestination();
            oscillator.connect(dst);
            const dummyAudioTrack = dst.stream.getAudioTracks()[0];
            const stream = new MediaStream([dummyVideoTrack, dummyAudioTrack]);
            localStreamRef.current = stream;
            setLocalStream(stream);
          }
        } catch (e) {
          console.error('Dummy stream fallback failed:', e);
        }

        return () => clearInterval(intervalId);
      }
    }
    initMedia();

    return () => {
      stopLocalTracksRef.current?.();
    };
  }, [chatMode]);

  // ─── Socket.IO connection ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('ghostchat_token');
    const sock = io(serverUrl, {
      reconnectionAttempts: 3,
      timeout: 5000,
      auth: { token }
    });
    socketRef.current = sock;
    setSocket(sock);

    sock.on('connect', () => {
      setIsOfflineSim(false);
      appendMessageRef.current?.('system', 'Connected to server. Ready to match.');

      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      const storedUser = readStoredUser();
      if (roomParam) {
        sock.emit('join_private_room', { roomId: roomParam, username: storedUser?.username ?? '' });
        setIsMatching(true);
        appendMessageRef.current?.('system', `Connecting to private room: ${roomParam}...`);
      }
    });

    sock.on('connect_error', () => {
      setIsOfflineSim(false);
      setIsMatching(false);
      appendMessageRef.current?.('system', 'Unable to reach the GhostChat server. Please try again in a moment.');
    });

    sock.on('online_count', (count: number) => {
      setOnlineCount(count);
    });

    sock.on('waiting', () => {
      setIsMatching(true);
      setIsConnected(false);
      appendMessageRef.current?.('system', 'Searching for a match matching your preferences...');
    });

    sock.on('matched', async ({ initiator, partnerId, partnerUsername: pUser }: { initiator: boolean; partnerId: string; partnerUsername?: string }) => {
      console.log(`Matched: ${partnerId} initiator=${initiator}`);
      setIsMatching(false);
      setIsConnected(true);
      setMessages([]);
      setPartnerUsername(pUser ?? null);
      appendMessageRef.current?.('system', 'You are paired with a stranger! Say hello.');

      cleanPeerConnectionRef.current?.();

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.ontrack = (event) => setRemoteStream(event.streams[0]);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current?.emit('ice_candidate', { candidate: event.candidate });
        }
      };

      if (initiator) {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current?.emit('offer', { offer });
        } catch (e) {
          console.error('Failed to create offer:', e);
        }
      }
    });

    sock.on('offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      const pc = peerRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('answer', { answer });
      } catch (e) {
        console.error('Failed to set offer/answer:', e);
      }
    });

    sock.on('answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = peerRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) {
        console.error('Failed to set answer remote description:', e);
      }
    });

    sock.on('ice_candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = peerRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    });

    sock.on('chat_message', ({ text }: { text: string }) => {
      appendMessageRef.current?.('stranger', text);
    });

    sock.on('typing', () => setStrangerTyping(true));
    sock.on('stop_typing', () => setStrangerTyping(false));

    sock.on('stranger_disconnected', () => {
      cleanPeerConnectionRef.current?.();
      setIsConnected(false);
      appendMessageRef.current?.('system', 'Stranger disconnected.');
    });

    sock.on('stopped', () => {
      cleanPeerConnectionRef.current?.();
      setIsConnected(false);
      setIsMatching(false);
      appendMessageRef.current?.('system', 'Session stopped.');
    });

    sock.on('private_invite_accepted', ({ roomId }: { roomId: string }) => {
      appendMessageRef.current?.('system', 'Invitation accepted! Directing to private room...');
      router.push(`/chat?room=${roomId}&mode=video`);
    });

    sock.on('follow_request_incoming', ({ senderUsername }: { senderUsername: string }) => {
      setIncomingFollowRequest(senderUsername);
    });

    sock.on('follow_accepted_incoming', ({ accepterUsername }: { accepterUsername: string }) => {
      appendMessageRef.current?.('system', `@${accepterUsername} accepted your follow request!`);
    });

    sock.on('follow_back_prompt', ({ targetUsername }: { targetUsername: string }) => {
      setFollowBackTarget(targetUsername);
    });

    sock.on('account_action', ({ type, message, until }: { type: string; message: string; until?: string }) => {
      appendMessageRef.current?.('system', `⚠️ ${message}`);
      if (type === 'permanent_ban' || type === 'suspended' || type === 'ip_banned') {
        setTimeout(() => router.push('/'), 3000);
      }
    });

    sock.on('private_invite_incoming', ({ senderUsername, roomId }: { senderUsername: string; roomId: string }) => {
      setIncomingInvite({ senderUsername, roomId });
    });

    return () => {
      cleanPeerConnectionRef.current?.();
      sock.disconnect();
    };
  }, [serverUrl, router]);

  // ─── Action handlers ─────────────────────────────────────────────────────
  const handleAcceptFollowIncoming = async () => {
    if (!incomingFollowRequest) return;
    const sender = incomingFollowRequest;
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;
    try {
      const res = await fetch(`${serverUrl}/api/follow/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUsername: sender })
      });
      if (res.ok) {
        socketRef.current?.emit('follow_accept', { targetUsername: sender });
        appendMessage('system', `You are now followed by @${sender}!`);
        setIncomingFollowRequest(null);
        // follow_back_prompt will come from server; as fallback also set locally:
        setFollowBackTarget(sender);
      }
    } catch (err) {
      console.error('Failed to accept follow request:', err);
      setIncomingFollowRequest(null);
    }
  };

  const handleDeclineFollowIncoming = async () => {
    if (!incomingFollowRequest) return;
    const sender = incomingFollowRequest;
    setIncomingFollowRequest(null);
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;
    try {
      await fetch(`${serverUrl}/api/follow/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUsername: sender })
      });
      // Request persisted in notifications by server — user can accept later
    } catch (err) {
      console.error('Failed to decline follow request:', err);
    }
  };

  const handleFollowBackAction = async () => {
    if (!followBackTarget) return;
    const token = localStorage.getItem('ghostchat_token');
    if (!token) { setFollowBackTarget(null); return; }
    try {
      const res = await fetch(`${serverUrl}/api/follow/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUsername: followBackTarget })
      });
      if (res.ok) {
        socketRef.current?.emit('follow_request', { targetUsername: followBackTarget });
        appendMessage('system', `You sent a follow request to @${followBackTarget}!`);
      }
    } catch (err) {
      console.error('Follow back failed:', err);
    } finally {
      setFollowBackTarget(null);
    }
  };

  const handleAcceptInviteIncoming = () => {
    if (!incomingInvite) return;
    socketRef.current?.emit('private_invite_accept', {
      targetUsername: incomingInvite.senderUsername,
      roomId: incomingInvite.roomId
    });
    const targetRoom = incomingInvite.roomId;
    setIncomingInvite(null);
    router.push(`/chat?room=${targetRoom}&mode=video`);
  };

  const handleAuthSuccess = (user: { username: string; token?: string }) => {
    setUsername(user.username);
    const stored = localStorage.getItem('ghostchat_user');
    if (stored) {
      try { setCurrentUser(JSON.parse(stored)); } catch (_) {}
    } else {
      setCurrentUser({ username: user.username });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ghostchat_token');
    localStorage.removeItem('ghostchat_user');
    setCurrentUser(null);
    setUsername('');
    router.push('/');
  };

  const handleBackToHome = () => {
    cleanPeerConnection();
    stopLocalTracks();
    socketRef.current?.disconnect();
    router.push('/');
  };

  const handleStartChat = () => {
    setMessages([]);
    setIsMatching(true);
    setIsConnected(false);

    if (isOfflineSim) {
      simulateOfflineMatch();
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        socketRef.current?.emit('join_private_room', { roomId: roomParam, username });
      } else {
        socketRef.current?.emit('find_stranger', {
          interests,
          language,
          country,
          mode: chatMode,
          username
        });
      }
    }
  };

  const handleNextStranger = () => {
    cleanPeerConnection();
    setIsConnected(false);
    setIsMatching(true);
    setMessages([]);
    if (isOfflineSim) simulateOfflineMatch();
    else socketRef.current?.emit('next_stranger');
  };

  const handleStopChat = () => {
    cleanPeerConnection();
    setIsConnected(false);
    setIsMatching(false);
    appendMessage('system', 'You stopped the chat.');
    if (!isOfflineSim) socketRef.current?.emit('stop');
  };

  const handleSendMessage = (text: string) => {
    appendMessage('self', text);
    if (isOfflineSim) {
      simulateOfflineReply(text);
    } else {
      socketRef.current?.emit('chat_message', { text });
      socketRef.current?.emit('stop_typing');
    }
  };

  const handleTyping = () => {
    if (isOfflineSim) return;
    socketRef.current?.emit('typing');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop_typing');
    }, 2000);
  };

  const handleToggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOn(videoTrack.enabled);
      }
    }
  };

  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const handleReportAbuse = async (reason: string, details: string) => {
    try {
      await fetch(`${serverUrl}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reported_username: 'Stranger', reason, details })
      });
    } catch { /* ignore */ }
    appendMessage('system', 'You reported this user. Matching next peer...');
    handleNextStranger();
  };

  // ─── Offline Simulation ──────────────────────────────────────────────────
  const simulateOfflineMatch = () => {
    const delay = 1500 + Math.random() * 2000;
    setTimeout(() => {
      setIsMatching(false);
      setIsConnected(true);
      appendMessage('system', '[SIMULATED MATCH] Paired with a friendly stranger!');

      const remoteCanvas = document.createElement('canvas');
      remoteCanvas.width = 640;
      remoteCanvas.height = 480;
      const ctx = remoteCanvas.getContext('2d');
      let f = 0;
      setInterval(() => {
        if (ctx) {
          ctx.fillStyle = '#1f1f1f';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#fff';
          ctx.font = '22px sans-serif';
          ctx.fillText(`Stranger Stream [Frame ${f++}]`, 40, 240);
        }
      }, 100);

      try {
        const canvasAny = remoteCanvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream };
        setRemoteStream(canvasAny.captureStream(15));
      } catch { /* ignore */ }
    }, delay);
  };

  const simulateOfflineReply = (userText: string) => {
    console.debug('[Sim] User said:', userText);
    setTimeout(() => {
      setStrangerTyping(true);
      setTimeout(() => {
        setStrangerTyping(false);
        const replies = [
          'Wow, tell me more!',
          'Haha nice. Where are you from?',
          `Same here! I also like ${interests[0] || 'chatting'}.`,
          'Hello! Glad we matched.',
          'This design is awesome.'
        ];
        appendMessage('stranger', replies[Math.floor(Math.random() * replies.length)]);
      }, 1500 + Math.random() * 1500);
    }, 500);
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex w-full flex-col overflow-hidden bg-brand-gray-light">
      <Navbar
        onlineCount={onlineCount}
        user={currentUser}
        onAuthClick={() => setAuthOpen(true)}
        onLogout={handleLogout}
        onAuthSuccess={handleAuthSuccess}
        socket={socket}
      />

      <div className={`flex-grow min-h-0 mx-auto w-full max-w-7xl ${chatMode === 'video' ? 'p-0 lg:p-6' : 'p-3 md:p-6'}`}>
        <div className={`flex h-full w-full ${chatMode === 'video' ? 'flex-col lg:flex-row gap-0 lg:gap-6 relative' : 'flex-col lg:flex-row gap-4'}`}>

          {/* LEFT COLUMN: Controls + Video Area */}
          <div className={`flex flex-col ${chatMode === 'video' ? 'relative w-full lg:w-[calc(70%-12px)] h-full lg:h-full overflow-hidden' : 'flex-1 gap-4'}`}>

            {/* Filters: text mode only, before match */}
            {chatMode === 'text' && !isConnected && !isMatching && (
              <div>
                <MatchingFilters
                  interests={interests} setInterests={setInterests}
                  language={language} setLanguage={setLanguage}
                  country={country} setCountry={setCountry}
                />
              </div>
            )}

            {/* Main Video/Text tile */}
            <div className={chatMode === 'video' ? 'absolute inset-0 lg:relative lg:flex-1 w-full h-full lg:h-auto min-h-0' : 'flex-1 min-h-[300px]'}>
              <VideoTile
                localStream={localStream}
                remoteStream={remoteStream}
                isCamOn={isCamOn}
                isMicOn={isMicOn}
                isConnected={isConnected}
                isMatching={isMatching}
                onReportClick={() => setReportOpen(true)}
                onAuthClick={() => setAuthOpen(true)}
                chatMode={chatMode}
                partnerUsername={partnerUsername}
                serverUrl={serverUrl}
                socket={socket}
                currentUser={currentUser}
              />
            </div>

            {/* Controls Bar */}
            <div className={`transition-all duration-300 ${
              chatMode === 'video'
                ? 'absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[90%] sm:w-auto flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-3.5 shadow-xl text-white'
                : 'flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-brand-gray-mid/60 bg-white p-3.5 shadow-xs text-brand-black'
            }`}>
              {!isConnected && !isMatching ? (
                <div className="flex flex-wrap items-center gap-2 justify-center">
                  <button
                    onClick={handleStartChat}
                    className={`flex items-center gap-1.5 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer ${
                      chatMode === 'video' ? 'bg-white text-brand-black hover:bg-white/95' : 'bg-brand-black text-white hover:bg-brand-black/95'
                    }`}
                  >
                    <Video size={16} /> Start Chatting
                  </button>
                  <button
                    onClick={handleBackToHome}
                    className={`flex items-center gap-1.5 rounded-xl border px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                      chatMode === 'video' ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-brand-gray-mid/85 bg-white text-brand-black hover:bg-brand-gray-light'
                    }`}
                  >
                    Back to Home
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNextStranger}
                    className={`flex items-center gap-1.5 rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                      chatMode === 'video' ? 'bg-white text-brand-black hover:bg-white/95' : 'bg-brand-black text-white hover:bg-brand-black/95'
                    }`}
                  >
                    <RefreshCw size={14} /> Next Stranger
                  </button>
                  <button
                    onClick={handleStopChat}
                    className={`flex items-center gap-1.5 rounded-xl border px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                      chatMode === 'video' ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-brand-gray-mid/85 bg-white text-brand-black hover:bg-brand-gray-light'
                    }`}
                  >
                    <Square size={13} /> Stop
                  </button>
                  <button
                    onClick={handleBackToHome}
                    className={`flex items-center gap-1.5 rounded-xl border px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                      chatMode === 'video' ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-brand-gray-mid/85 bg-white text-brand-black hover:bg-brand-gray-light'
                    }`}
                  >
                    Back to Home
                  </button>
                </div>
              )}

              {/* Media Toggles — video mode only */}
              {chatMode === 'video' && (
                <div className="flex items-center gap-2 border-l border-white/20 pl-3">
                  <button
                    onClick={handleToggleCam}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 cursor-pointer ${
                      isCamOn ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' : 'bg-red-600 text-white shadow-xs'
                    }`}
                    title={isCamOn ? 'Turn Camera Off' : 'Turn Camera On'}
                  >
                    {isCamOn ? <Video size={17} /> : <VideoOff size={17} />}
                  </button>
                  <button
                    onClick={handleToggleMic}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 cursor-pointer ${
                      isMicOn ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20' : 'bg-red-600 text-white shadow-xs'
                    }`}
                    title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
                  >
                    {isMicOn ? <Volume2 size={17} /> : <MicOff size={17} />}
                  </button>
                </div>
              )}

              {/* Mobile Chat Toggle — video mode only */}
              {chatMode === 'video' && (
                <button
                  type="button"
                  onClick={() => setShowMobileChat(!showMobileChat)}
                  className={`lg:hidden flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 cursor-pointer relative ${
                    showMobileChat ? 'bg-white text-brand-black shadow-xs' : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                  }`}
                  title="Toggle Chat"
                >
                  <MessageSquare size={17} />
                  {messages.length > 0 && messages[messages.length - 1].sender === 'stranger' && !showMobileChat && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Chat Panel */}
          <div className={`${
            chatMode === 'video'
              ? `absolute lg:relative inset-y-0 right-0 z-40 w-full sm:w-[350px] lg:w-[calc(30%-12px)] h-full lg:h-auto shrink-0 transition-transform duration-300 transform ${showMobileChat ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`
              : 'w-full lg:w-[380px] h-[350px] lg:h-auto shrink-0'
          }`}>
            {/* Mobile Chat Close Header */}
            {chatMode === 'video' && showMobileChat && (
              <div className="flex lg:hidden items-center justify-between bg-white border-b border-brand-gray-mid/40 p-4">
                <span className="font-bold text-sm text-brand-black">Stranger Chat</span>
                <button type="button" onClick={() => setShowMobileChat(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-brand-gray-light text-brand-black/60 cursor-pointer">
                  ✕
                </button>
              </div>
            )}

            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              isConnected={isConnected}
              isTyping={strangerTyping}
            />
          </div>

          {/* Peer Profile slide-in panel */}
          {isConnected && partnerUsername && (
            <div className={`${
              chatMode === 'video'
                ? 'absolute lg:relative top-16 left-4 lg:top-auto lg:left-auto z-35 max-w-[280px] lg:max-w-none w-auto lg:w-72 h-auto lg:h-auto shrink-0 animate-in slide-in-from-right duration-200'
                : 'w-full lg:w-72 h-[350px] lg:h-auto shrink-0 animate-in slide-in-from-right duration-200'
            }`}>
              <PeerProfileCard
                partnerUsername={partnerUsername}
                serverUrl={serverUrl}
                socket={socket}
              />
            </div>
          )}
        </div>
      </div>

      {/* Overlays */}
      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} onSubmit={handleReportAbuse} />
      <TermsModal isOpen={showTerms} onAccept={() => setShowTerms(false)} />

      {/* Rich Follow Request Popup */}
      {incomingFollowRequest && (
        <FollowRequestPopup
          senderUsername={incomingFollowRequest}
          serverUrl={serverUrl}
          onAccept={handleAcceptFollowIncoming}
          onDecline={handleDeclineFollowIncoming}
        />
      )}

      {/* Follow Back Popup */}
      {followBackTarget && !incomingFollowRequest && (
        <FollowBackPopup
          targetUsername={followBackTarget}
          serverUrl={serverUrl}
          onFollowBack={handleFollowBackAction}
          onSkip={() => setFollowBackTarget(null)}
        />
      )}

      {/* Incoming call invite dialog */}
      {incomingInvite && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-brand-gray-mid/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 animate-pulse">
              <PhoneCall size={24} />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-brand-black text-lg">Incoming Call</h4>
              <p className="text-xs text-brand-black/60 leading-relaxed">
                <strong className="font-extrabold text-brand-black">@{incomingInvite.senderUsername}</strong> is inviting you to a private chat session.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleAcceptInviteIncoming}
                className="flex-grow rounded-xl bg-emerald-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-emerald-700 active:scale-95 cursor-pointer">
                Accept and Join
              </button>
              <button onClick={() => setIncomingInvite(null)}
                className="rounded-xl border border-brand-gray-mid/60 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-black hover:bg-brand-gray-light cursor-pointer">
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        serverUrl={serverUrl}
      />
    </div>
  );
}
