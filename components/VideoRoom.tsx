'use client';

import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import VideoTile from './VideoTile';
import ChatPanel from './ChatPanel';
import MatchingFilters from './MatchingFilters';
import ReportModal from './ReportModal';
import TermsModal from './TermsModal';
import { Video, MessageSquare, Volume2, VideoOff, MicOff, RefreshCw, Square, ShieldAlert } from 'lucide-react';

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

  useEffect(() => {
    const accepted = localStorage.getItem('ghostchat_terms_accepted') === 'true';
    if (!accepted) {
      setShowTerms(true);
    }
  }, []);

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

  // --- Viewport Resize Adjustments ---
  const [viewportHeight, setViewportHeight] = useState('100vh');

  useEffect(() => {
    const handleResize = () => {
      // Set viewport height dynamically to solve 100vh issue on mobile
      setViewportHeight(`${window.innerHeight}px`);
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
        // Fallback: Generate dummy video stream via canvas
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        let frame = 0;
        const intervalId = setInterval(() => {
          if (ctx) {
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = '#fff';
            ctx.font = '24px sans-serif';
            ctx.fillText(`Local Camera Simulator [Frame ${frame++}]`, 40, 240);
            ctx.beginPath();
            ctx.arc(320, 320, 20 + Math.sin(frame * 0.1) * 10, 0, Math.PI * 2);
            ctx.fillStyle = '#f5f5f5';
            ctx.fill();
          }
        }, 100);

        try {
          const dummyVideoTrack = (canvas as any).captureStream(15).getVideoTracks()[0];
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

  // --- Socket.IO & WebRTC Core Engine ---
  useEffect(() => {
    console.log(`🔌 Connecting to GhostChat hub at: ${serverUrl}`);
    const socket = io(serverUrl, {
      reconnectionAttempts: 3,
      timeout: 5000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to signaling server');
      setIsOfflineSim(false);
      appendSystemMessage('Connected to server. Ready to match.');
    });

    socket.on('connect_error', () => {
      console.warn('⚠️ Server connection failed. Activating Offline Sandbox Simulator...');
      setIsOfflineSim(true);
      appendSystemMessage('Offline Sandbox Simulator enabled.');
    });

    socket.on('waiting', () => {
      setIsMatching(true);
      setIsConnected(false);
      appendSystemMessage('Searching for a match matching your preferences...');
    });

    socket.on('matched', async ({ initiator, partnerId }: { initiator: boolean; partnerId: string }) => {
      console.log(`Matched with peer: ${partnerId}. Initiator: ${initiator}`);
      setIsMatching(false);
      setIsConnected(true);
      setMessages([]);
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
      socketRef.current?.emit('find_stranger', {
        interests,
        language,
        country,
        mode: chatMode
      });
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
      style={{ height: viewportHeight }}
      className="flex w-full flex-col overflow-hidden bg-brand-gray-light p-3 md:p-6"
    >
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col lg:flex-row gap-4">
        
        {/* LEFT COLUMN: Controls + Video Area */}
        <div className="flex flex-1 flex-col gap-4">
          
          {/* Filters overlay */}
          {!isConnected && !isMatching && (
            <MatchingFilters
              interests={interests}
              setInterests={setInterests}
              language={language}
              setLanguage={setLanguage}
              country={country}
              setCountry={setCountry}
            />
          )}

          {/* Main Video tile */}
          <div className="flex-1 min-h-[300px]">
            <VideoTile
              localStream={localStream}
              remoteStream={remoteStream}
              isCamOn={isCamOn}
              isMicOn={isMicOn}
              isConnected={isConnected}
              isMatching={isMatching}
              onReportClick={() => setReportOpen(true)}
              chatMode={chatMode}
            />
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-brand-gray-mid/60 bg-white p-3.5 shadow-xs">
            {/* Start / Stop matching */}
            {!isConnected && !isMatching ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartChat}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-black px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 shadow-sm"
                >
                  <Video size={16} />
                  Start Chatting
                </button>
                <button
                  onClick={handleBackToHome}
                  className="flex items-center gap-1.5 rounded-xl border border-brand-gray-mid/85 bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-gray-light active:scale-95"
                >
                  Back to Home
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNextStranger}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-black px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95"
                >
                  <RefreshCw size={14} className="animate-spin-slow" />
                  Next Stranger
                </button>
                <button
                  onClick={handleStopChat}
                  className="flex items-center gap-1.5 rounded-xl border border-brand-gray-mid/85 bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-gray-light active:scale-95"
                >
                  <Square size={13} />
                  Stop
                </button>
                <button
                  onClick={handleBackToHome}
                  className="flex items-center gap-1.5 rounded-xl border border-brand-gray-mid/85 bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-gray-light active:scale-95"
                >
                  Back to Home
                </button>
              </div>
            )}

            {/* Media Toggles (Video only) */}
            {chatMode === 'video' && (
              <div className="flex items-center gap-2 border-l border-brand-gray-mid/40 pl-3">
                <button
                  onClick={handleToggleCam}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 ${
                    isCamOn
                      ? 'bg-brand-gray-light text-brand-black border border-brand-gray-mid/50'
                      : 'bg-red-600 text-white shadow-xs'
                  }`}
                  title={isCamOn ? 'Turn Camera Off' : 'Turn Camera On'}
                >
                  {isCamOn ? <Video size={17} /> : <VideoOff size={17} />}
                </button>
                <button
                  onClick={handleToggleMic}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all active:scale-90 ${
                    isMicOn
                      ? 'bg-brand-gray-light text-brand-black border border-brand-gray-mid/50'
                      : 'bg-red-600 text-white shadow-xs'
                  }`}
                  title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
                >
                  {isMicOn ? <Volume2 size={17} /> : <MicOff size={17} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Text Chat Panel */}
        <div className="w-full lg:w-[380px] h-[350px] lg:h-auto shrink-0">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            isTyping={strangerTyping}
            onTyping={handleTyping}
            isConnected={isConnected}
          />
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
    </div>
  );
}
