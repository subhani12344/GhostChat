'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  sender: 'self' | 'stranger' | 'system';
  text: string;
  timestamp: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  isTyping: boolean;
  onTyping: () => void;
  isConnected: boolean;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  isTyping,
  onTyping,
  isConnected
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = inputText.trim();
    if (cleanText && isConnected) {
      onSendMessage(cleanText);
      setInputText('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTyping();
  };

  return (
    <div className="flex h-full flex-col bg-white border border-brand-gray-mid/40 rounded-2xl shadow-xs overflow-hidden">
      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center space-y-2">
            <p className="text-sm font-bold text-brand-black/60">No conversation started</p>
            <p className="text-xs text-brand-black/45 max-w-xs leading-relaxed">
              Click Start to match with an anonymous user and type text here.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-1.5 animate-in fade-in duration-300">
                  <span className="rounded-full bg-brand-gray-light px-3.5 py-1 text-2xs font-bold uppercase tracking-wider text-brand-black/55 border border-brand-gray-mid/20">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isSelf = msg.sender === 'self';
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${
                  isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                } animate-in slide-in-from-bottom-2 duration-200`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isSelf
                      ? 'bg-brand-black text-white rounded-br-xs'
                      : 'bg-brand-gray-light text-brand-black rounded-bl-xs border border-brand-gray-mid/35'
                  }`}
                >
                  <p className="break-words white-space-pre-wrap">{msg.text}</p>
                </div>
                <span className="text-[10px] text-brand-black/35 mt-1 font-mono tracking-tight px-1">
                  {msg.timestamp}
                </span>
              </div>
            );
          })
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 mr-auto max-w-[80%] bg-brand-gray-light border border-brand-gray-mid/35 rounded-2xl rounded-bl-xs px-4 py-3 animate-in fade-in duration-200">
            <span className="text-xs text-brand-black/60 font-semibold tracking-wide">Stranger is typing</span>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-black/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-brand-black/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-brand-black/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSend} className="flex border-t border-brand-gray-mid/40 p-3 bg-white">
        <input
          type="text"
          disabled={!isConnected}
          placeholder={isConnected ? 'Type a message...' : 'Waiting for connection...'}
          value={inputText}
          onChange={handleInputChange}
          className="flex-1 rounded-xl bg-brand-gray-light border border-brand-gray-mid/40 py-2.5 px-4 text-sm text-brand-black outline-none placeholder-brand-black/30 transition-all focus:border-brand-black focus:bg-white disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || !isConnected}
          className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-black text-white hover:bg-brand-black/95 transition-colors active:scale-95 disabled:opacity-40 disabled:scale-100"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
