import React from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { User, Users } from 'lucide-react';

interface NavbarProps {
  onlineCount: number;
  user: { username: string } | null;
  onAuthClick: () => void;
  onLogout: () => void;
  showChatLink?: boolean;
}

export default function Navbar({
  onlineCount,
  user,
  onAuthClick,
  onLogout,
  showChatLink = true
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-gray-mid/40 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Logo size={36} />
        </Link>

        <div className="flex items-center gap-4">
          {/* Active Online Counter */}
          <div className="flex items-center gap-1.5 rounded-full bg-brand-gray-light px-3.5 py-1.5 text-xs font-semibold text-brand-black/70 border border-brand-gray-mid/30">
            <Users size={14} className="text-brand-black" />
            <span className="tabular-nums">{onlineCount.toLocaleString()}</span> online
          </div>

          {/* User Auth Section */}
          {user ? (
            <div className="flex items-center gap-3.5">
              <div className="hidden items-center gap-1.5 text-sm sm:flex">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-black text-white text-xs font-bold uppercase">
                  {user.username.charAt(0)}
                </div>
                <span className="font-medium text-brand-black">{user.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="rounded-full border border-brand-black px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-black transition-all hover:bg-brand-black hover:text-white"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="flex items-center gap-1.5 rounded-full bg-brand-black px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95"
            >
              <User size={13} />
              Login / Sign Up
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
