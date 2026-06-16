'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Search, UserCheck, UserMinus, Heart, PhoneCall, Globe, FileText, Check, LogOut, AlertCircle, RefreshCw, User } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { username: string } | null;
  serverUrl: string;
  socket: Socket | null;
  onLogout: () => void;
  onProfileUpdate?: (u: { username: string }) => void;
  onAuthTrigger?: () => void;
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  currentUser,
  serverUrl,
  socket,
  onLogout,
  onProfileUpdate,
  onAuthTrigger
}: ProfileDrawerProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [profileImg, setProfileImg] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const [profileLoadErrorType, setProfileLoadErrorType] = useState<'auth' | 'network' | 'server' | null>(null);

  const [activeListTab, setActiveListTab] = useState<'followers' | 'following' | null>(null);
  const [listData, setListData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listLoading, setListLoading] = useState(false);

  const [callingState, setCallingState] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop image states
  const [rawImageToCrop, setRawImageToCrop] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fetchMyProfile = async () => {
    if (!currentUser || currentUser.username.startsWith('Guest_') || currentUser.username.startsWith('Guest-')) return;
    const token = localStorage.getItem('ghostchat_token');
    if (!token) {
      setProfileLoadError('You are not logged in. Please sign in to view your profile.');
      setProfileLoadErrorType('auth');
      return;
    }

    setProfileLoading(true);
    setProfileLoadError(null);
    setProfileLoadErrorType(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(`${serverUrl}/api/users/${currentUser.username}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNickname(data.nickname || '');
        setBio(data.bio || '');
        setProfileImg(data.profile_img || '');
      } else if (res.status === 401 || res.status === 403) {
        // Token is expired or invalid — clear it and prompt re-login
        localStorage.removeItem('ghostchat_token');
        localStorage.removeItem('ghostchat_user');
        setProfileLoadError('Your session has expired. Please log in again to view your profile.');
        setProfileLoadErrorType('auth');
      } else if (res.status === 404) {
        setProfileLoadError('Profile not found. Your account may have been removed.');
        setProfileLoadErrorType('server');
      } else {
        setProfileLoadError('Could not load profile. The server returned an error. Please try again.');
        setProfileLoadErrorType('server');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setProfileLoadError('The server is taking too long to respond. It may still be waking up — please try again in 30 seconds.');
        setProfileLoadErrorType('network');
      } else {
        setProfileLoadError('Network error. Please check your connection and try again.');
        setProfileLoadErrorType('network');
      }
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setProfile(null);
      setProfileLoadError(null);
      setProfileLoadErrorType(null);
      fetchMyProfile();
      setActiveListTab(null);
    }
  }, [isOpen, currentUser, serverUrl]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawImageToCrop(reader.result as string);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPosition({ x: clientX - dragStart.x, y: clientY - dragStart.y });
  };

  const handleDragEnd = () => setIsDragging(false);

  const executeCrop = () => {
    if (!rawImageToCrop) return;
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 300, 300);
      ctx.translate(150, 150);
      ctx.translate(position.x, position.y);
      ctx.scale(zoom, zoom);
      let displayWidth = 300;
      let displayHeight = 300;
      if (imageAspect > 1) displayWidth = 300 * imageAspect;
      else displayHeight = 300 / imageAspect;
      ctx.drawImage(img, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
      const croppedData = canvas.toDataURL('image/jpeg', 0.85);
      setProfileImg(croppedData);
      setRawImageToCrop(null);
    };
    img.src = rawImageToCrop;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccess(null);

    const token = localStorage.getItem('ghostchat_token');
    if (!token) { setSaveLoading(false); return; }

    try {
      const res = await fetch(`${serverUrl}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ nickname, bio, profile_img: profileImg })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess('Profile updated successfully!');
        setProfile((prev: any) => ({ ...prev, nickname: data.user.nickname, bio: data.user.bio, profile_img: data.user.profile_img }));
        if (onProfileUpdate) onProfileUpdate({ username: currentUser!.username });
        setEditMode(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'Failed to save profile changes');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  const fetchList = async (type: 'followers' | 'following') => {
    setListLoading(true);
    setListData([]);
    const token = localStorage.getItem('ghostchat_token');
    if (!token) { setListLoading(false); return; }

    try {
      const endpoint = type === 'followers' ? '/api/followers' : '/api/following';
      const res = await fetch(`${serverUrl}${endpoint}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const list = await res.json();
        const onlineRes = await fetch(`${serverUrl}/api/followers/mutual-online`, { headers: { 'Authorization': `Bearer ${token}` } });
        const onlineMutuals = onlineRes.ok ? await onlineRes.json() : [];
        const onlineNames = onlineMutuals.filter((u: any) => u.online).map((u: any) => u.username);
        const mappedList = list.map((item: any) => ({
          ...item,
          online: onlineNames.includes(item.username),
          isMutual: onlineMutuals.some((x: any) => x.username === item.username)
        }));
        setListData(mappedList);
      }
    } catch (err) {
      console.error('Failed to load social list:', err);
    } finally {
      setListLoading(false);
    }
  };

  const handleTabClick = (tab: 'followers' | 'following') => {
    setActiveListTab(tab);
    setSearchQuery('');
    fetchList(tab);
  };

  const handleUnfollow = async (targetUsername: string) => {
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;
    try {
      const res = await fetch(`${serverUrl}/api/follow/unfollow`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ targetUsername })
      });
      if (res.ok) { setListData(prev => prev.filter(x => x.username !== targetUsername)); fetchMyProfile(); }
    } catch (err) { console.error('Failed to unfollow user:', err); }
  };

  const handleInitiateCall = (targetUsername: string) => {
    if (!socket) return;
    setCallingState({ targetUsername, status: 'calling' });
    socket.emit('private_invite', { targetUsername });
  };

  useEffect(() => {
    if (!socket) return;
    const handleInviteAccepted = ({ accepterUsername, roomId }: any) => {
      if (callingState && callingState.targetUsername === accepterUsername) {
        setCallingState((prev: any) => ({ ...prev, status: 'accepted' }));
        setTimeout(() => { onClose(); router.push(`/chat?room=${roomId}&mode=video`); }, 1000);
      }
    };
    socket.on('private_invite_accepted', handleInviteAccepted);
    return () => { socket.off('private_invite_accepted', handleInviteAccepted); };
  }, [socket, callingState]);

  if (!isOpen) return null;
  if (!currentUser) return null;

  const isGuest = currentUser.username.startsWith('Guest_') || currentUser.username.startsWith('Guest-') || (currentUser as any).isAnonymous;
  const filteredList = listData.filter(item =>
    item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.nickname && item.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl border-l border-gray-100 flex flex-col animate-in slide-in-from-right duration-250">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white shrink-0">
          <h3 className="text-base font-bold text-gray-900 tracking-tight">
            {activeListTab ? (activeListTab === 'followers' ? 'Followers' : 'Following') : 'My Profile'}
          </h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {activeListTab ? (
          /* --- Followers / Following List --- */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 pt-4 shrink-0">
              <button onClick={() => setActiveListTab(null)} className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
                ← Back to Profile
              </button>
            </div>
            <div className="grid grid-cols-2 border-b border-gray-100 mt-3 shrink-0">
              {(['followers', 'following'] as const).map(tab => (
                <button key={tab} onClick={() => handleTabClick(tab)}
                  className={`py-3 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeListTab === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="px-5 py-3 border-b border-gray-100 shrink-0">
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-3 text-gray-300" />
                <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-8 pr-3 text-xs text-gray-800 outline-none focus:border-gray-400 focus:bg-white transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {listLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
                </div>
              ) : filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                  <User size={28} className="mb-2 opacity-30" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">No users found</span>
                </div>
              ) : filteredList.map(item => (
                <div key={item.username} className="flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.profile_img ? (
                      <img src={item.profile_img} alt={item.username} className="h-10 w-10 rounded-xl object-cover border border-gray-100 shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white text-sm font-bold shrink-0">
                        {item.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="block font-semibold text-xs text-gray-900 truncate">{item.nickname || item.username}</span>
                      <span className="block text-[10px] text-gray-400 truncate">@{item.username}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.online && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />}
                    {item.isMutual && item.online && (
                      <button onClick={() => handleInitiateCall(item.username)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer" title="Call">
                        <PhoneCall size={12} />
                      </button>
                    )}
                    {activeListTab === 'following' && (
                      <button onClick={() => handleUnfollow(item.username)}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[10px] font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer">
                        <UserMinus size={10} /> Unfollow
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* --- Profile Detail View --- */
          <div className="flex-grow flex flex-col overflow-y-auto">
            {isGuest ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                  <Globe size={32} />
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900 text-base">Guest Session</h4>
                  <p className="text-xs text-gray-500 max-w-xs leading-relaxed">You're connected as an anonymous guest. Create an account to get a persistent profile, followers, and notifications.</p>
                  {onAuthTrigger && (
                    <button type="button" onClick={() => { onClose(); onAuthTrigger(); }}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800 active:scale-95 transition-all cursor-pointer">
                      Sign Up / Log In
                    </button>
                  )}
                </div>
              </div>
            ) : profileLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-semibold text-gray-600">Loading profile...</p>
                  <p className="text-[10px] text-gray-400">This may take a moment if the server is starting up.</p>
                </div>
              </div>
            ) : profileLoadError ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center px-6">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${profileLoadErrorType === 'auth' ? 'bg-amber-50 text-amber-500' : 'bg-red-50 text-red-400'}`}>
                  <AlertCircle size={28} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-gray-900">
                    {profileLoadErrorType === 'auth' ? 'Session Expired' : 'Could Not Load Profile'}
                  </p>
                  <p className="text-[11px] text-gray-500 leading-relaxed max-w-xs">{profileLoadError}</p>
                </div>
                {profileLoadErrorType === 'auth' ? (
                  <button onClick={() => { onClose(); if (onAuthTrigger) onAuthTrigger(); }}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800 active:scale-95 transition-all cursor-pointer">
                    Log In Again
                  </button>
                ) : (
                  <button onClick={fetchMyProfile}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800 active:scale-95 transition-all cursor-pointer">
                    <RefreshCw size={12} /> Try Again
                  </button>
                )}
              </div>
            ) : !profile ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {success && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-700 text-center font-medium">{success}</div>
                )}
                {error && (
                  <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs text-red-600 text-center font-medium">{error}</div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="relative group cursor-pointer" onClick={() => editMode && fileInputRef.current?.click()}>
                      {profileImg ? (
                        <img src={profileImg} alt={profile.username} className="h-20 w-20 rounded-2xl object-cover border-2 border-gray-100 shadow-sm" />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-900 text-white text-3xl font-bold shadow-sm border-2 border-gray-800/10">
                          {profile.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {editMode && (
                        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera size={18} />
                        </div>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
                    <div>
                      <h4 className="font-bold text-gray-900 text-base leading-tight">{profile.nickname || profile.username}</h4>
                      <span className="text-xs text-gray-400">@{profile.username}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => handleTabClick('followers')}
                      className="group rounded-2xl border border-gray-100 bg-gray-50 py-4 text-center hover:border-gray-300 hover:bg-white transition-all">
                      <span className="block text-xl font-black text-gray-900 leading-none">{profile.followersCount ?? 0}</span>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-1">Followers</span>
                    </button>
                    <button type="button" onClick={() => handleTabClick('following')}
                      className="group rounded-2xl border border-gray-100 bg-gray-50 py-4 text-center hover:border-gray-300 hover:bg-white transition-all">
                      <span className="block text-xl font-black text-gray-900 leading-none">{profile.followingCount ?? 0}</span>
                      <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-1">Following</span>
                    </button>
                  </div>

                  {/* Fields */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Display Name</label>
                      {editMode ? (
                        <input type="text" required value={nickname} onChange={e => setNickname(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 outline-none focus:border-gray-500 focus:bg-white transition-all" />
                      ) : (
                        <p className="text-sm font-medium text-gray-700 py-1">{profile.nickname || <span className="text-gray-300 italic">Not set</span>}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Bio</label>
                      {editMode ? (
                        <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the world something about you..."
                          className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-4 text-sm text-gray-900 outline-none focus:border-gray-500 focus:bg-white transition-all resize-none" />
                      ) : (
                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100 min-h-14 whitespace-pre-wrap">
                          {profile.bio || <span className="text-gray-300 italic">No bio yet.</span>}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {editMode ? (
                      <div className="flex gap-2.5">
                        <button type="submit" disabled={saveLoading}
                          className="flex-1 rounded-xl bg-gray-900 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800 active:scale-95 disabled:opacity-50 transition-all cursor-pointer">
                          {saveLoading ? 'Saving...' : 'Save Profile'}
                        </button>
                        <button type="button" onClick={() => { setEditMode(false); setNickname(profile.nickname || ''); setBio(profile.bio || ''); setProfileImg(profile.profile_img || ''); }}
                          className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 transition-all cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setEditMode(true)}
                        className="w-full rounded-xl bg-gray-900 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800 active:scale-95 transition-all cursor-pointer">
                        Edit Profile
                      </button>
                    )}
                  </div>
                </form>

                {/* Logout */}
                <div className="pt-2 border-t border-gray-100">
                  <button onClick={() => { onLogout(); onClose(); }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50/50 py-3 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all cursor-pointer">
                    <LogOut size={13} /> Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calling overlay */}
      {callingState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 animate-pulse">
              <PhoneCall size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-gray-900 text-base">Calling @{callingState.targetUsername}</h4>
              <p className="text-xs text-gray-400">Waiting for them to accept...</p>
            </div>
            {callingState.status === 'accepted' ? (
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 font-semibold bg-emerald-50 py-2 rounded-xl">
                <Check size={14} /> Accepted! Connecting...
              </div>
            ) : (
              <button onClick={() => setCallingState(null)}
                className="w-full rounded-xl border border-gray-200 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 transition-all cursor-pointer">
                Cancel Call
              </button>
            )}
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {rawImageToCrop && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-5 flex flex-col animate-in zoom-in-95 duration-200">
            <div className="text-center">
              <h4 className="font-bold text-gray-900 text-sm">Crop Profile Picture</h4>
              <p className="text-[10px] text-gray-400 mt-0.5">Drag to reposition · scroll to zoom</p>
            </div>
            <div onMouseDown={handleDragStart} onMouseMove={handleDragMove} onMouseUp={handleDragEnd} onMouseLeave={handleDragEnd}
              onTouchStart={handleDragStart} onTouchMove={handleDragMove} onTouchEnd={handleDragEnd}
              className="w-full aspect-square relative overflow-hidden bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center cursor-move">
              <img src={rawImageToCrop} alt="Crop" onLoad={e => setImageAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
                style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`, width: imageAspect > 1 ? 'auto' : '100%', height: imageAspect > 1 ? '100%' : 'auto', maxWidth: 'none', maxHeight: 'none' }}
                className="absolute select-none pointer-events-none transition-transform duration-75" />
              <div className="absolute inset-0 border-4 border-black/40 rounded-xl pointer-events-none flex items-center justify-center">
                <div className="w-full h-full rounded-full border border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-semibold text-gray-400">
                <span>Zoom</span><span>{Math.round(zoom * 100)}%</span>
              </div>
              <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-900" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={executeCrop}
                className="flex-1 rounded-xl bg-gray-900 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-gray-800 active:scale-95 transition-all cursor-pointer">
                Apply Crop
              </button>
              <button type="button" onClick={() => setRawImageToCrop(null)}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
