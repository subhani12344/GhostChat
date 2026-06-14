'use client';

import React, { useRef, useEffect } from 'react';
import { CameraOff, MicOff, ShieldAlert, Video } from 'lucide-react';

interface VideoTileProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCamOn: boolean;
  isMicOn: boolean;
  isConnected: boolean;
  isMatching: boolean;
  onReportClick: () => void;
  chatMode?: 'video' | 'text';
}

export default function VideoTile({
  localStream,
  remoteStream,
  isCamOn,
  isMicOn,
  isConnected,
  isMatching,
  onReportClick,
  chatMode = 'video'
}: VideoTileProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream && chatMode === 'video') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCamOn, chatMode]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && chatMode === 'video') {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isConnected, chatMode]);

  // Text Mode Viewport Layout: B/W minimalist graphics panel
  if (chatMode === 'text') {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-brand-gray-light border border-brand-gray-mid/60 rounded-2xl p-6 text-center select-none overflow-hidden">
        {/* Report Button (Top Left Overlay) */}
        {isConnected && (
          <button
            onClick={onReportClick}
            className="absolute left-4 top-4 z-20 flex items-center gap-1 rounded-lg bg-black/5 hover:bg-black/10 border border-brand-gray-mid/85 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-red-500 transition-all active:scale-95"
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
    <div className="relative flex h-full w-full items-center justify-center bg-brand-black overflow-hidden rounded-2xl border border-brand-gray-dark/50">
      
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

      {/* 3. REPORT STRANGER BUTTON */}
      {isConnected && (
        <button
          onClick={onReportClick}
          className="absolute left-4 top-4 z-20 flex items-center gap-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-red-500 transition-all hover:bg-red-600 hover:text-white"
        >
          <ShieldAlert size={12} />
          Report
        </button>
      )}
    </div>
  );
}
