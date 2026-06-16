'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, UserCheck, Heart, Video, PhoneCall } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

interface NotificationCenterProps {
  serverUrl: string;
  socket: Socket | null;
  currentUser: { username: string } | null;
  onAuthTrigger?: () => void;
}

export default function NotificationCenter({
  serverUrl,
  socket,
  currentUser,
  onAuthTrigger
}: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const isGuest = currentUser?.username.startsWith('Guest_') || currentUser?.username.startsWith('Guest-') || (currentUser as any)?.isAnonymous;

  const fetchNotifications = async () => {
    if (!currentUser || isGuest) return;
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;

    try {
      const res = await fetch(`${serverUrl}/api/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentUser, serverUrl]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to live socket events for notifications
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNewNotif = (notif: any) => {
      // Add immediately to state
      setNotifications(prev => [notif, ...prev]);

      // Trigger standard system beep or browser notification if desired
      if (typeof window !== 'undefined' && 'Notification' in window && (window as any).Notification.permission === 'granted') {
        new (window as any).Notification('New GhostChat Alert', {
          body: `${notif.sender_username} sent you a ${notif.type.replace('_', ' ')}.`
        });
      }
    };

    socket.on('new_notification', handleNewNotif);
    
    // Also support direct calling invitation overlays
    const handlePrivateInvite = (invite: any) => {
      // Trigger new notification
      handleNewNotif({
        id: invite.id,
        sender_username: invite.senderUsername,
        type: 'invite',
        status: 'unread',
        details: invite.roomId,
        created_at: new Date().toISOString()
      });
    };
    socket.on('private_invite_incoming', handlePrivateInvite);

    return () => {
      socket.off('new_notification', handleNewNotif);
      socket.off('private_invite_incoming', handlePrivateInvite);
    };
  }, [socket, currentUser]);

  const handleToggle = async () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      // Mark read on backend
      const token = localStorage.getItem('ghostchat_token');
      if (!token) return;

      try {
        await fetch(`${serverUrl}/api/notifications/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
      } catch (err) {
        console.error('Failed to mark notifications read:', err);
      }
    }
  };

  const handleAcceptFollow = async (senderUsername: string, id: number) => {
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;

    try {
      const res = await fetch(`${serverUrl}/api/follow/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername: senderUsername })
      });

      if (res.ok) {
        if (socket) {
          socket.emit('follow_accept', { targetUsername: senderUsername });
        }
        // Remove accepted notification from state
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to accept follow request:', err);
    }
  };

  const handleDeclineFollow = async (senderUsername: string, id: number) => {
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;

    try {
      const res = await fetch(`${serverUrl}/api/follow/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername: senderUsername })
      });

      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to decline follow request:', err);
    }
  };

  const handleAcceptInvite = (senderUsername: string, roomId: string, id: number) => {
    if (socket) {
      socket.emit('private_invite_accept', { targetUsername: senderUsername, roomId });
    }
    // Delete notification
    handleDeleteNotif(id);
    setOpen(false);

    // Redirect immediately to the private room!
    router.push(`/chat?room=${roomId}&mode=video`);
  };

  const handleDeleteNotif = async (id: number) => {
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;

    try {
      const res = await fetch(`${serverUrl}/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  if (!currentUser) return null;

  if (isGuest) {
    return (
      <div className="relative">
        <button
          onClick={onAuthTrigger}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-mid/30 bg-white text-brand-black/45 hover:text-brand-black transition-all active:scale-95 cursor-pointer"
          title="Sign in to view notifications"
        >
          <Bell size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-mid/30 bg-white text-brand-black transition-all hover:bg-brand-gray-light active:scale-95 cursor-pointer"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[9px] font-extrabold text-white animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 mt-2.5 w-80 rounded-2xl border border-brand-gray-mid/45 bg-white py-3 shadow-2xl z-[200] animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center justify-between border-b border-brand-gray-mid/30 px-4 pb-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-black">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand-gray-light px-2 py-0.5 text-[9px] font-bold text-brand-black/60">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-brand-black/5">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Bell size={24} className="text-brand-black/25 mb-1.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-black/40">No notifications</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-brand-gray-light/60 transition-colors ${
                    notif.status === 'unread' ? 'bg-brand-gray-light/25' : 'hover:bg-brand-gray-light/10'
                  }`}
                >
                  {/* Icon indicator */}
                  <div className="mt-0.5 shrink-0">
                    {notif.type === 'follow_request' && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
                        <UserCheck size={14} />
                      </div>
                    )}
                    {notif.type === 'follow_accept' && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50 border border-pink-100 text-pink-600">
                        <Heart size={14} className="fill-pink-500 text-pink-500" />
                      </div>
                    )}
                    {notif.type === 'invite' && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 animate-pulse">
                        <PhoneCall size={14} />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-brand-black leading-snug">
                      <strong className="font-extrabold">@{notif.sender_username}</strong>{' '}
                      {notif.type === 'follow_request' && 'requested to follow you.'}
                      {notif.type === 'follow_accept' && 'accepted your follow request.'}
                      {notif.type === 'invite' && 'invited you to join a private room.'}
                    </p>

                    {/* Action buttons */}
                    {notif.type === 'follow_request' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleAcceptFollow(notif.sender_username, notif.id)}
                          className="flex h-6 items-center gap-1 rounded bg-brand-black px-2.5 text-[10px] font-bold text-white hover:bg-brand-black/90 active:scale-95 transition-all"
                        >
                          <Check size={10} /> Accept
                        </button>
                        <button
                          onClick={() => handleDeclineFollow(notif.sender_username, notif.id)}
                          className="flex h-6 items-center gap-1 rounded border border-brand-gray-mid/60 bg-white px-2.5 text-[10px] font-bold text-brand-black hover:bg-brand-gray-light active:scale-95 transition-all"
                        >
                          <X size={10} /> Ignore
                        </button>
                      </div>
                    )}

                    {notif.type === 'invite' && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleAcceptInvite(notif.sender_username, notif.details, notif.id)}
                          className="flex h-6 items-center gap-1 rounded bg-emerald-600 px-2.5 text-[10px] font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                          <Video size={10} /> Join Call
                        </button>
                        <button
                          onClick={() => handleDeleteNotif(notif.id)}
                          className="flex h-6 items-center gap-1 rounded border border-brand-gray-mid/60 bg-white px-2.5 text-[10px] font-bold text-brand-black hover:bg-brand-gray-light active:scale-95 transition-all"
                        >
                          <X size={10} /> Dismiss
                        </button>
                      </div>
                    )}

                    {notif.type === 'follow_accept' && (
                      <button
                        onClick={() => handleDeleteNotif(notif.id)}
                        className="text-[10px] text-brand-black/40 hover:text-brand-black transition-colors mt-1 font-bold underline"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
