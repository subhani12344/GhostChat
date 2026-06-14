'use client';

import React, { useState } from 'react';
import { Shield, Video, MessageSquare, X, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AnonymousModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { username: string }) => void;
  serverUrl: string;
}

export default function AnonymousModal({ isOpen, onClose, onSuccess, serverUrl }: AnonymousModalProps) {
  const router = useRouter();
  const [loadingMode, setLoadingMode] = useState<'video' | 'text' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectMode = async (mode: 'video' | 'text') => {
    setLoadingMode(mode);
    setError(null);

    try {
      const response = await fetch(`${serverUrl}/api/auth/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to secure anonymous session');
      }

      const data = await response.json();

      // Store credentials securely
      localStorage.setItem('ghostchat_token', data.token);
      localStorage.setItem('ghostchat_user', JSON.stringify({ username: data.username, isAnonymous: true }));

      // Trigger success callback to update parent state
      onSuccess({ username: data.username });

      // Close modal
      onClose();

      // Redirect to selected service
      router.push(`/chat?mode=${mode}`);
    } catch (err: any) {
      console.error('Anonymous registration failure:', err);
      setError('Connection failed. Please check your network or try again.');
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-brand-gray-mid/30 animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Close button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-brand-black/40 hover:text-brand-black transition-colors"
          disabled={loadingMode !== null}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gray-light border border-brand-gray-mid/30 text-brand-black animate-pulse">
            <Shield size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-brand-black flex items-center justify-center gap-1.5">
              Secure Anonymous Chat
              <Sparkles size={16} className="text-brand-black/60" />
            </h3>
            <p className="text-xs text-brand-black/55 mt-1 max-w-xs leading-relaxed">
              Connect instantly with a stranger. To ensure safety and protect your identity, this session is cryptographically secured.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 mb-4 text-center">
            ⚠️ {error}
          </div>
        )}

        {/* Options */}
        <div className="space-y-4">
          {/* Video Option */}
          <button
            onClick={() => handleSelectMode('video')}
            disabled={loadingMode !== null}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${
              loadingMode === 'video'
                ? 'border-brand-black bg-brand-black text-white'
                : 'border-brand-gray-mid/50 hover:border-brand-black bg-white text-brand-black hover:bg-brand-gray-light/30'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl border ${
                loadingMode === 'video' 
                  ? 'bg-white/10 border-white/20 text-white' 
                  : 'bg-brand-gray-light border-brand-gray-mid/30 text-brand-black group-hover:bg-white transition-colors'
              }`}>
                <Video size={20} />
              </div>
              <div>
                <span className="block font-bold text-sm">Anonymous Video Chat</span>
                <span className={`block text-xs leading-normal mt-0.5 ${
                  loadingMode === 'video' ? 'text-white/70' : 'text-brand-black/50'
                }`}>
                  Requires camera & microphone. Realtime WebRTC.
                </span>
              </div>
            </div>
            {loadingMode === 'video' && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent shrink-0" />
            )}
          </button>

          {/* Text Option */}
          <button
            onClick={() => handleSelectMode('text')}
            disabled={loadingMode !== null}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${
              loadingMode === 'text'
                ? 'border-brand-black bg-brand-black text-white'
                : 'border-brand-gray-mid/50 hover:border-brand-black bg-white text-brand-black hover:bg-brand-gray-light/30'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl border ${
                loadingMode === 'text' 
                  ? 'bg-white/10 border-white/20 text-white' 
                  : 'bg-brand-gray-light border-brand-gray-mid/30 text-brand-black group-hover:bg-white transition-colors'
              }`}>
                <MessageSquare size={20} />
              </div>
              <div>
                <span className="block font-bold text-sm">Anonymous Text Chat</span>
                <span className={`block text-xs leading-normal mt-0.5 ${
                  loadingMode === 'text' ? 'text-white/70' : 'text-brand-black/50'
                }`}>
                  Text messaging only. Camera remains disabled.
                </span>
              </div>
            </div>
            {loadingMode === 'text' && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent shrink-0" />
            )}
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6">
          <p className="text-[10px] text-brand-black/40 leading-relaxed max-w-[280px] mx-auto">
            By connecting, you agree to our Terms & Conditions. Bad behavior or abuse results in immediate ban.
          </p>
        </div>

      </div>
    </div>
  );
}
