'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import VideoRoom from '@/components/VideoRoom';

function ChatRoomContent() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get('mode') || 'video') as 'video' | 'text';
  const serverUrl = (typeof window !== "undefined" && (window as any).GHOSTCHAT_SERVER_URL) || process.env.NEXT_PUBLIC_SERVER_URL || "https://ghostchat-backend.onrender.com";

  return (
    <div className="w-full bg-brand-gray-light">
      <VideoRoom serverUrl={serverUrl} chatMode={mode} />
    </div>
  );
}

export default function ChatRoom() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-brand-gray-light">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-black border-t-transparent" />
          <span className="text-xs font-bold uppercase tracking-wider text-brand-black/60">Initializing GhostChat...</span>
        </div>
      </div>
    }>
      <ChatRoomContent />
    </Suspense>
  );
}
