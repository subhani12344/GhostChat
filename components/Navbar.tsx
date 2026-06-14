import React, { useState } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { User, Users } from 'lucide-react';
import AnonymousModal from './AnonymousModal';
import NotificationCenter from './NotificationCenter';
import ProfileDrawer from './ProfileDrawer';
import { Socket } from 'socket.io-client';

interface NavbarProps {
  onlineCount: number;
  user: { username: string } | null;
  onAuthClick: () => void;
  onLogout: () => void;
  showChatLink?: boolean;
  onAuthSuccess?: (user: { username: string }) => void;
  socket?: Socket | null;
}

export default function Navbar({
  onlineCount,
  user,
  onAuthClick,
  onLogout,
  showChatLink = true,
  onAuthSuccess,
  socket = null
}: NavbarProps) {
  const [anonOpen, setAnonOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-gray-mid/40 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Logo size={36} />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Active Online Counter */}
          <div className="flex items-center gap-1.5 rounded-full bg-brand-gray-light px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-brand-black/70 border border-brand-gray-mid/30">
            <Users size={14} className="text-brand-black" />
            <span className="tabular-nums">{onlineCount.toLocaleString()}</span> online
          </div>

          {/* Anonymous Chat Button */}
          {!user && (
            <button
              onClick={() => setAnonOpen(true)}
              className="flex items-center gap-1 rounded-full border border-brand-black/25 bg-white px-3 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-gray-light active:scale-95 cursor-pointer font-bold"
            >
              Anonymous Chat
            </button>
          )}

          {/* User Auth Section */}
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3.5">
              {/* Notifications bell dropdown */}
              <NotificationCenter
                serverUrl={serverUrl}
                socket={socket || null}
                currentUser={user}
              />

              {/* Clickable Username Profile trigger */}
              <div
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-1.5 text-sm cursor-pointer hover:opacity-85 transition-opacity"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-black text-white text-xs font-bold uppercase select-none">
                  {user.username.charAt(0)}
                </div>
                <span className="font-semibold text-brand-black hidden sm:inline select-none">
                  {user.username}
                </span>
              </div>

              <button
                onClick={onLogout}
                className="rounded-full border border-brand-black px-3 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-black hover:text-white cursor-pointer font-bold"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="flex items-center gap-1.5 rounded-full bg-brand-black px-3 sm:px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 cursor-pointer font-bold"
            >
              <User size={13} />
              Login / Sign Up
            </button>
          )}
        </div>
      </div>

      <AnonymousModal
        isOpen={anonOpen}
        onClose={() => setAnonOpen(false)}
        onSuccess={(u) => {
          if (onAuthSuccess) {
            onAuthSuccess(u);
          }
        }}
        serverUrl={serverUrl}
      />

      <ProfileDrawer
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        currentUser={user}
        serverUrl={serverUrl}
        socket={socket || null}
        onLogout={onLogout}
        onProfileUpdate={onAuthSuccess}
      />
    </header>
  );
}


