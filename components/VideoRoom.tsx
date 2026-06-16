'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { Video, MessageSquare, Volume2, VideoOff, MicOff, RefreshCw, Square, ShieldAlert, UserCheck, PhoneCall, SlidersHorizontal } from 'lucide-react';

interface Message {
  id: string;
  sender: 'self' | 'stranger' | 'system';
  text: string;
  timestamp: string;
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

export default function VideoRoom({ serverUrl, chatMode }: VideoRoomProps) {
  const router = useRouter();
  const [showTerms, setShowTerms] = useState(false);
  const [username, setUsername] = useState('');
  const [partnerUsername, setPartnerUsername] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const accepted = localStorage.getItem('ghostchat_terms_accepted') === 'true';
    if (!accepted) {
      setShowTerms(true);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('ghostchat_token');
    const stored = localStorage.getItem('ghostchat_user');
    if (!token || !stored) {
      router.push('/');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.username) {
        setUsername(parsed.username);
        setCurrentUser(parsed);
      } else {
        router.push('/');
      }
    } catch (err) {
      router.push('/');
    }
  }, [router]);

  // Socket & WebRTC refs
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Filter preferences
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
  const [isTyping, setIsTyping] = useState(false);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isOfflineSim, setIsOfflineSim] = useState(false);
  const [incomingFollowRequest, setIncomingFollowRequest] = useState<string | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<{ senderUsername: string; roomId: string } | null>(null);
  const [showVideoFilters, setShowVideoFilters] = useState(false);

  // --- Viewport Resize Adjustments ---
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      // Set viewport height dynamically to solve 100vh issue on mobile
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

  // --- Initialize Media ---
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
      } catch (err) {
        console.warn('Physical camera/mic denied or missing. Bootstrapping dummy stream for testing...', err);
        // Fallback: Generate dummy silent video stream via canvas
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        let frame = 0;
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
            ctx.fillText(`Allow camera access to share your video`, 320, 260);
            frame++;
          }
        }, 200);

        try {
          const dummyVideoTrack = (canvas as any).captureStream(5).getVideoTracks()[0];
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const dst = audioContext.createMediaStreamDestination();
          oscillator.connect(dst);
          const dummyAudioTrack = dst.stream.getAudioTracks()[0];
          
          const stream = new MediaStream([dummyVideoTrack, dummyAudioTrack]);
          localStreamRef.current = stream;
          setLocalStream(stream);
        } catch (e) {
          console.error('Failed to create dummy stream fallback', e);
        }

        return () => clearInterval(intervalId);
      }
    }
    initMedia();

    return () => {
      stopLocalTracks();
    };
  }, [chatMode]);

  const stopLocalTracks = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  useEffect(() => {
    console.log(`🔌 Connecting to GhostChat hub at: ${serverUrl}`);
    const token = localStorage.getItem('ghostchat_token');
    const socket = io(serverUrl, {
      reconnectionAttempts: 3,
      timeout: 5000,
      auth: { token }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to signaling server');
      setIsOfflineSim(false);
      appendSystemMessage('Connected to server. Ready to match.');

      // Auto join private room if parameter exists
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        socket.emit('join_private_room', { roomId: roomParam, username });
        setIsMatching(true);
        appendSystemMessage(`Connecting to private room: ${roomParam}...`);
      }
    });

    socket.on('connect_error', () => {
      setIsOfflineSim(false);
      setIsMatching(false);
      appendSystemMessage('Unable to reach the GhostChat server. Please try again in a moment.');
    });

    socket.on('online_count', (count: number) => {
      setOnlineCount(count);
    });

    socket.on('waiting', () => {
      setIsMatching(true);
      setIsConnected(false);
      appendSystemMessage('Searching for a match matching your preferences...');
    });

    socket.on('matched', async ({ initiator, partnerId, partnerUsername }: { initiator: boolean; partnerId: string; partnerUsername?: string }) => {
      console.log(`Matched with peer: ${partnerId}. Initiator: ${initiator} | Username: ${partnerUsername}`);
      setIsMatching(false);
      setIsConnected(true);
      setMessages([]);
      setPartnerUsername(partnerUsername || null);
      appendSystemMessage('You are paired with a stranger! Say hello.');

      // Clear previous peer connection
      cleanPeerConnection();

      // Create new peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = pc;

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle remote tracks
      pc.ontrack = (event) => {
        console.log('Got remote track', event.streams[0]);
        setRemoteStream(event.streams[0]);
      };

      // Relay ICE candidates
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
          console.error('Failed to create offer', e);
        }
      }
    });

    socket.on('offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      const pc = peerRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('answer', { answer });
      } catch (e) {
        console.error('Failed to set offer / create answer', e);
      }
    });

    socket.on('answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = peerRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (e) {
        console.error('Failed to set remote description from answer', e);
      }
    });

    socket.on('ice_candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = peerRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate', e);
      }
    });

    socket.on('chat_message', ({ text }: { text: string }) => {
      appendMessage('stranger', text);
    });

    socket.on('typing', () => {
      setStrangerTyping(true);
    });

    socket.on('stop_typing', () => {
      setStrangerTyping(false);
    });

    socket.on('stranger_disconnected', () => {
      cleanPeerConnection();
      setIsConnected(false);
      appendSystemMessage('Stranger disconnected.');
    });

    socket.on('stopped', () => {
      cleanPeerConnection();
      setIsConnected(false);
      setIsMatching(false);
      appendSystemMessage('Session stopped.');
    });

    socket.on('private_invite_accepted', ({ roomId }) => {
      appendSystemMessage('Invitation accepted! Directing to private room...');
      router.push(`/chat?room=${roomId}&mode=video`);
    });

    socket.on('follow_request_incoming', ({ senderUsername }) => {
      setIncomingFollowRequest(senderUsername);
    });

    socket.on('follow_accepted_incoming', ({ accepterUsername }) => {
      appendSystemMessage(`@${accepterUsername} accepted your follow request!`);
    });

    socket.on('private_invite_incoming', ({ senderUsername, roomId }) => {
      setIncomingInvite({ senderUsername, roomId });
    });

    return () => {
      cleanPeerConnection();
      socket.disconnect();
    };
  }, [serverUrl]);

  const cleanPeerConnection = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    setRemoteStream(null);
    setPartnerUsername(null);
  };

  const handleAcceptFollowIncoming = async () => {
    if (!incomingFollowRequest) return;
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;

    try {
      const res = await fetch(`${serverUrl}/api/follow/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername: incomingFollowRequest })
      });
      if (res.ok) {
        socketRef.current?.emit('follow_accept', { targetUsername: incomingFollowRequest });
        appendSystemMessage(`You are now following @${incomingFollowRequest}!`);
      }
    } catch (err) {
      console.error('Failed to accept follow request:', err);
    } finally {
      setIncomingFollowRequest(null);
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
      setCurrentUser(JSON.parse(stored));
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
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    router.push('/');
  };

  // --- Message helpers ---
  const appendMessage = (sender: 'self' | 'stranger' | 'system', text: string) => {
    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2),
        sender,
        text,
        timestamp: formattedTime
      }
    ]);
  };

  const appendSystemMessage = (text: string) => {
    appendMessage('system', text);
  };

  // --- UI Action Handlers ---
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

    if (isOfflineSim) {
      simulateOfflineMatch();
    } else {
      socketRef.current?.emit('next_stranger');
    }
  };

  const handleStopChat = () => {
    cleanPeerConnection();
    setIsConnected(false);
    setIsMatching(false);
    appendSystemMessage('You stopped the chat.');

    if (!isOfflineSim) {
      socketRef.current?.emit('stop');
    }
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
    if (!isTyping) {
      setIsTyping(true);
      socketRef.current?.emit('typing');
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
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

  // --- Submission functions ---
  const handleReportAbuse = async (reason: string, details: string) => {
    // Send telemetry to server
    try {
      await fetch(`${serverUrl}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reported_username: 'Stranger',
          reason,
          details
        })
      });
    } catch (err) {}

    appendSystemMessage('You reported this user. Matching next peer...');
    handleNextStranger();
  };

  // --- Offline Simulation Mode Triggers ---
  const simulateOfflineMatch = () => {
    const delay = 1500 + Math.random() * 2000;
    setTimeout(() => {
      setIsMatching(false);
      setIsConnected(true);
      appendSystemMessage('[SIMULATED MATCH] Paired with a friendly stranger!');
      
      // Setup mock remote canvas stream
      const remoteCanvas = document.createElement('canvas');
      remoteCanvas.width = 640;
      remoteCanvas.height = 480;
      const ctx = remoteCanvas.getContext('2d');
      let f = 0;
      const t = setInterval(() => {
        if (ctx) {
          ctx.fillStyle = '#1f1f1f';
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = '#fff';
          ctx.font = '22px sans-serif';
          ctx.fillText(`Stranger Stream [Frame ${f++}]`, 40, 240);
          ctx.fillRect(100 + Math.sin(f * 0.05) * 80, 300, 30, 30);
        }
      }, 100);

      try {
        const stream = (remoteCanvas as any).captureStream(15);
        setRemoteStream(stream);
      } catch (e) {}
    }, delay);
  };

  const simulateOfflineReply = (userText: string) => {
    // Simulate typing delay
    setTimeout(() => {
      setStrangerTyping(true);
      setTimeout(() => {
        setStrangerTyping(false);
        const replies = [
          'Wow, that is fascinating! Tell me more.',
          'Haha nice. Where are you from?',
          'Same here! I also like ' + (interests[0] || 'chatting with new people') + '.',
          'Hello! Glad we matched here.',
          'Yes, this minimalist design is awesome.'
        ];
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        appendMessage('stranger', randomReply);
      }, 1500 + Math.random() * 1500);
    }, 500);
  };

  return (
    <div
      ref={containerRef}
      className="flex w-full flex-col overflow-hidden bg-brand-gray-light"
    >
      <Navbar
        onlineCount={onlineCount}
        user={currentUser}
        onAuthClick={() => setAuthOpen(true)}
        onLogout={handleLogout}
        onAuthSuccess={handleAuthSuccess}
        socket={socketRef.current}
      />

      <div
        className={`flex-grow min-h-0 mx-auto w-full max-w-7xl ${
          chatMode === 'video' ? 'p-0 lg:p-6' : 'p-3 md:p-6'
        }`}
      >
        <div
          className={`flex h-full w-full ${
            chatMode === 'video'
              ? 'flex-col lg:flex-row gap-0 lg:gap-6 relative'
              : 'flex-col lg:flex-row gap-4'
          }`}
        >
        
        {/* LEFT COLUMN: Controls + Video Area */}
        <div
          className={`flex flex-col ${
            chatMode === 'video'
              ? 'relative w-full lg:w-[calc(70%-12px)] h-full lg:h-full overflow-hidden'
              : 'flex-1 gap-4'
          }`}
        >
          
          {/* Filters overlay: only show in text mode before match */}
          {chatMode === 'text' && !isConnected && !isMatching && (
            <div>
              <MatchingFilters
                interests={interests}
                setInterests={setInterests}
                language={language}
                setLanguage={setLanguage}
                country={country}
                setCountry={setCountry}
              />
            </div>
          )}

          {/* Main Video tile */}
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
              socket={socketRef.current}
              currentUser={currentUser}
            />
          </div>

          {/* Controls Bar */}
          <div
            className={`transition-all duration-300 ${
              chatMode === 'video'
                ? 'absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[90%] sm:w-auto flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-3.5 shadow-xl text-white'
                : 'flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-brand-gray-mid/60 bg-white p-3.5 shadow-xs text-brand-black'
            }`}
          >
            {/* Start / Stop matching */}
            {!isConnected && !isMatching ? (
              <div className="flex flex-wrap items-center gap-2 justify-center">
                {/* Video mode: filters toggle button */}
                {chatMode === 'video' && (
                  <button
                    onClick={() => setShowVideoFilters(v => !v)}
                    className={`flex items-center gap-1.5 rounded-xl border px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                      showVideoFilters
                        ? 'border-white/40 bg-white/20 text-white'
                        : 'border-white/20 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                    }`}
                    title="Matchmaking Filters"
                  >
                    <SlidersHorizontal size={14} />
                    Filters
                  </button>
                )}
                <button
                  onClick={handleStartChat}
                  className={`flex items-center gap-1.5 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer ${
                    chatMode === 'video'
                      ? 'bg-white text-brand-black hover:bg-white/95'
                      : 'bg-brand-black text-white hover:bg-brand-black/95'
                  }`}
                >
                  <Video size={16} />
                  Start Chatting
                </button>
                <button
                  onClick={handleBackToHome}
                  className={`flex items-center gap-1.5 rounded-xl border px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                    chatMode === 'video'
                      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                      : 'border-brand-gray-mid/85 bg-white text-brand-black hover:bg-brand-gray-light'
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
                    chatMode === 'video'
                      ? 'bg-white text-brand-black hover:bg-white/95'
                      : 'bg-brand-black text-white hover:bg-brand-black/95'
                  }`}
                >
                  <RefreshCw size={14} className="animate-spin-slow" />
                  Next Stranger
                </button>
                <button
                  onClick={handleStopChat}
                  className={`flex items-center gap-1.5 rounded-xl border px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                    chatMode === 'video'
                      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                      : 'border-brand-gray-mid/85 bg-white text-brand-black hover:bg-brand-gray-light'
                  }`}
                >
                  <Square size={13} />
                  Stop
                </button>
                <button
                  onClick={handleBackToHome}
                  className={`flex items-center gap-1.5 rounded-xl border px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                    chatMode === 'video'
                      ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                      : 'border-brand-gray-mid/85 bg-white text-brand-black hover:bg-brand-gray-light'
                  }`}
                >
                  Back to Home
                </button>
              </div>
            )}

            {/* Media Toggles (Video only) */}
            {chatMode === 'video' && (
              <div className="flex items-center gap-2 border-l border-white/20 pl-3">
                <button
                  onClick={handleToggleCam}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 cursor-pointer ${
                    isCamOn
                      ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                      : 'bg-red-600 text-white shadow-xs'
                  }`}
                  title={isCamOn ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {isCamOn ? <Video size={17} /> : <VideoOff size={17} />}
                </button>
                <button
                  onClick={handleToggleMic}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 cursor-pointer ${
                    isMicOn
                      ? 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                      : 'bg-red-600 text-white shadow-xs'
                  }`}
                  title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {isMicOn ? <Volume2 size={17} /> : <MicOff size={17} />}
                </button>
              </div>
            )}

            {/* Mobile Chat Button Toggle */}
            {chatMode === 'video' && (
              <button
                type="button"
                onClick={() => setShowMobileChat(!showMobileChat)}
                className={`lg:hidden flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 cursor-pointer relative ${
                  showMobileChat
                    ? 'bg-white text-brand-black shadow-xs'
                    : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
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

        {/* VIDEO MODE: Collapsible filter panel, shown above controls bar */}
        {chatMode === 'video' && showVideoFilters && !isConnected && !isMatching && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-md animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="rounded-2xl border border-white/10 bg-black/75 backdrop-blur-md p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Matchmaking Filters</span>
                <button onClick={() => setShowVideoFilters(false)} className="text-white/40 hover:text-white transition-colors text-xs">✕</button>
              </div>
              <MatchingFilters
                interests={interests}
                setInterests={setInterests}
                language={language}
                setLanguage={setLanguage}
                country={country}
                setCountry={setCountry}
              />
            </div>
          </div>
        )}
        <div
          className={`${
            chatMode === 'video'
              ? `absolute lg:relative inset-y-0 right-0 z-40 w-full sm:w-[350px] lg:w-[calc(30%-12px)] h-full lg:h-auto shrink-0 transition-transform duration-300 transform ${
                  showMobileChat ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
                }`
              : 'w-full lg:w-[380px] h-[350px] lg:h-auto shrink-0'
          }`}
        >
          {/* Mobile Chat Close Header */}
          {chatMode === 'video' && showMobileChat && (
            <div className="flex lg:hidden items-center justify-between bg-white border-b border-brand-gray-mid/40 p-4">
              <span className="font-bold text-sm text-brand-black">Stranger Chat</span>
              <button
                type="button"
                onClick={() => setShowMobileChat(false)}
                className="text-brand-black/55 hover:text-brand-black font-bold uppercase tracking-wider text-2xs border border-brand-gray-mid/60 rounded-lg px-2.5 py-1.5 cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isTyping={strangerTyping}
            onTyping={handleTyping}
            isConnected={isConnected}
          />
        </div>

        {/* Peer Profile slide-in panel */}
        {isConnected && partnerUsername && (
          <div
            className={`${
              chatMode === 'video'
                ? 'absolute lg:relative top-16 left-4 lg:top-auto lg:left-auto z-35 max-w-[280px] lg:max-w-none w-auto lg:w-72 h-auto lg:h-auto shrink-0 animate-in slide-in-from-right duration-200'
                : 'w-full lg:w-72 h-[350px] lg:h-auto shrink-0 animate-in slide-in-from-right duration-200'
            }`}
          >
            <PeerProfileCard
              partnerUsername={partnerUsername}
              serverUrl={serverUrl}
              socket={socketRef.current}
            />
          </div>
        )}
      </div>
    </div>

      {/* Report Abuse Overlay */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReportAbuse}
      />

      {/* Terms Accept Overlay */}
      <TermsModal
        isOpen={showTerms}
        onAccept={() => setShowTerms(false)}
      />

      {/* Mid-call incoming follow request overlay */}
      {incomingFollowRequest && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-brand-gray-mid/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 border border-blue-100 text-blue-600 animate-bounce">
              <UserCheck size={24} />
            </div>
            
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-brand-black text-lg">Follow Request</h4>
              <p className="text-xs text-brand-black/60 leading-relaxed">
                <strong className="font-extrabold text-brand-black">@{incomingFollowRequest}</strong> wants to follow you. Accepting will update follower metrics instantly.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAcceptFollowIncoming}
                className="flex-1 rounded-xl bg-brand-black py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 cursor-pointer"
              >
                Accept
              </button>
              <button
                onClick={() => setIncomingFollowRequest(null)}
                className="rounded-xl border border-brand-gray-mid/60 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-black hover:bg-brand-gray-light cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mid-call incoming call invite overlay */}
      {incomingInvite && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-brand-gray-mid/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 animate-pulse">
              <PhoneCall size={24} />
            </div>
            
            <div className="space-y-1.5">
              <h4 className="font-extrabold text-brand-black text-lg">Incoming Call</h4>
              <p className="text-xs text-brand-black/60 leading-relaxed">
                <strong className="font-extrabold text-brand-black">@{incomingInvite.senderUsername}</strong> is inviting you to a private chat session right now.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAcceptInviteIncoming}
                className="flex-grow rounded-xl bg-emerald-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-emerald-700 active:scale-95 cursor-pointer"
              >
                Accept and Join
              </button>
              <button
                onClick={() => setIncomingInvite(null)}
                className="rounded-xl border border-brand-gray-mid/60 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-black hover:bg-brand-gray-light cursor-pointer"
              >
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Registration/Login Overlay */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        serverUrl={serverUrl}
      />
    </div>
  );
}
