'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, Search, UserCheck, UserMinus, Heart, PhoneCall, Globe, FileText, Check } from 'lucide-react';
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
}

export default function ProfileDrawer({
  isOpen,
  onClose,
  currentUser,
  serverUrl,
  socket,
  onLogout,
  onProfileUpdate
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

  // Tabs for follower lists: null | 'followers' | 'following'
  const [activeListTab, setActiveListTab] = useState<'followers' | 'following' | null>(null);
  const [listData, setListData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listLoading, setListLoading] = useState(false);

  // Call invitation overlay state: null | { targetUsername, roomId, status: 'calling' | 'accepted' | 'declined' }
  const [callingState, setCallingState] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current user profile
  const fetchMyProfile = async () => {
    if (!currentUser || currentUser.username.startsWith('Guest_')) return;
    const token = localStorage.getItem('ghostchat_token');
    if (!token) return;

    try {
      const res = await fetch(`${serverUrl}/api/users/${currentUser.username}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNickname(data.nickname || '');
        setBio(data.bio || '');
        setProfileImg(data.profile_img || '');
      }
    } catch (err) {
      console.error('Failed to load self profile:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMyProfile();
      setActiveListTab(null);
    }
  }, [isOpen, currentUser, serverUrl]);

  // Handle image upload and base64 conversion
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (limit to 1.5MB for base64 storage)
    if (file.size > 1.5 * 1024 * 1024) {
      setError('Image must be smaller than 1.5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImg(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    setSuccess(null);

    const token = localStorage.getItem('ghostchat_token');
    if (!token) {
      setSaveLoading(false);
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nickname, bio, profile_img: profileImg })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess('Profile updated successfully!');
        setProfile((prev: any) => ({
          ...prev,
          nickname: data.user.nickname,
          bio: data.user.bio,
          profile_img: data.user.profile_img
        }));
        if (onProfileUpdate) {
          onProfileUpdate({ username: currentUser!.username });
        }
        setEditMode(false);
      } else {
        const errData = await res.json();
        setError(errData.message || 'Failed to save profile changes');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  };

  // Fetch Followers or Following lists
  const fetchList = async (type: 'followers' | 'following') => {
    setListLoading(true);
    setListData([]);
    const token = localStorage.getItem('ghostchat_token');
    if (!token) {
      setListLoading(false);
      return;
    }

    try {
      // If we want to check mutual follower online states, we fetch online mutual list for 'following', or direct list.
      // To keep it clean, we'll fetch general follower/following and cross-check online status against backend endpoint!
      const endpoint = type === 'followers' ? '/api/followers' : '/api/following';
      const res = await fetch(`${serverUrl}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();

        // Also fetch online mutual status
        const onlineRes = await fetch(`${serverUrl}/api/followers/mutual-online`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetUsername })
      });
      if (res.ok) {
        setListData(prev => prev.filter(x => x.username !== targetUsername));
        fetchMyProfile();
      }
    } catch (err) {
      console.error('Failed to unfollow user:', err);
    }
  };

  // Direct Call Invite
  const handleInitiateCall = (targetUsername: string) => {
    if (!socket) return;
    setCallingState({
      targetUsername,
      status: 'calling'
    });

    socket.emit('private_invite', { targetUsername });
  };

  // Listen to private call accept
  useEffect(() => {
    if (!socket) return;

    const handleInviteAccepted = ({ accepterUsername, roomId }: any) => {
      if (callingState && callingState.targetUsername === accepterUsername) {
        setCallingState((prev: any) => ({ ...prev, status: 'accepted' }));
        setTimeout(() => {
          onClose();
          router.push(`/chat?room=${roomId}&mode=video`);
        }, 1000);
      }
    };

    socket.on('private_invite_accepted', handleInviteAccepted);

    return () => {
      socket.off('private_invite_accepted', handleInviteAccepted);
    };
  }, [socket, callingState]);

  if (!isOpen) return null;
  if (!currentUser) return null;
  const isGuest = currentUser.username.startsWith('Guest_');

  // Filtered List based on search query
  const filteredList = listData.filter(
    item =>
      item.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nickname && item.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Background click to close */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Drawer content */}
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl border-l border-brand-gray-mid/30 flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-gray-mid/30 px-6 py-4 shrink-0">
          <h3 className="text-lg font-bold tracking-tight text-brand-black">
            {activeListTab ? (activeListTab === 'followers' ? 'Followers' : 'Following') : 'My Profile'}
          </h3>
          <button onClick={onClose} className="text-brand-black/40 hover:text-brand-black transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Dynamic content */}
        {activeListTab ? (
          /* followers / following view */
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* Back button */}
            <div className="px-6 pt-4 shrink-0">
              <button
                onClick={() => setActiveListTab(null)}
                className="text-xs font-bold uppercase tracking-wider text-brand-black/60 hover:text-brand-black transition-colors"
              >
                ← Back to Profile
              </button>
            </div>

            {/* Instagram style list tabs */}
            <div className="grid grid-cols-2 border-b border-brand-gray-light mt-3 shrink-0">
              <button
                onClick={() => handleTabClick('followers')}
                className={`py-3 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all ${
                  activeListTab === 'followers' ? 'border-brand-black text-brand-black' : 'border-transparent text-brand-black/40 hover:text-brand-black'
                }`}
              >
                Followers
              </button>
              <button
                onClick={() => handleTabClick('following')}
                className={`py-3 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all ${
                  activeListTab === 'following' ? 'border-brand-black text-brand-black' : 'border-transparent text-brand-black/40 hover:text-brand-black'
                }`}
              >
                Following
              </button>
            </div>

            {/* Search Input */}
            <div className="px-6 py-3 border-b border-brand-gray-light shrink-0">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-brand-black/40" />
                <input
                  type="text"
                  placeholder="Search user profiles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2 pl-9 pr-4 text-xs text-brand-black outline-none transition-all focus:border-brand-black focus:bg-white"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {listLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-black border-t-transparent" />
                </div>
              ) : filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-brand-black/40">
                  <Search size={24} className="mb-2" />
                  <span className="text-xs font-bold uppercase tracking-wider">No users found</span>
                </div>
              ) : (
                filteredList.map((item) => (
                  <div key={item.username} className="flex items-center justify-between gap-3 border-b border-brand-gray-light pb-3.5">
                    {/* User profile info */}
                    <div className="flex items-center gap-3 min-w-0">
                      {item.profile_img ? (
                        <img
                          src={item.profile_img}
                          alt={item.username}
                          className="h-10 w-10 rounded-xl object-cover border border-brand-gray-mid/20 shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-black text-white text-sm font-extrabold shrink-0">
                          {item.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="block font-bold text-xs text-brand-black truncate">
                          {item.nickname || item.username}
                        </span>
                        <span className="block text-[10px] text-brand-black/50 truncate">@{item.username}</span>
                      </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Mutual online direct call */}
                      {item.isMutual && item.online && (
                        <button
                          onClick={() => handleInitiateCall(item.username)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer"
                          title="Call / Meet again"
                        >
                          <PhoneCall size={13} />
                        </button>
                      )}

                      {/* Online dot indicator */}
                      {item.online && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1 animate-pulse" title="Online" />
                      )}

                      {activeListTab === 'following' && (
                        <button
                          onClick={() => handleUnfollow(item.username)}
                          className="flex items-center gap-1 rounded-lg border border-brand-gray-mid/60 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-black hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer"
                        >
                          <UserMinus size={10} /> Unfollow
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Profile Detail View */
          <div className="flex-grow flex flex-col p-6 overflow-y-auto space-y-6">
            {isGuest ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <Globe size={48} className="text-brand-black/30 animate-pulse" />
                <div className="space-y-2">
                  <h4 className="font-extrabold text-brand-black text-lg">Anonymous Guest Profile</h4>
                  <p className="text-xs text-brand-black/55 max-w-xs leading-relaxed">
                    You are connected securely as a guest user. Register or log in to create a persistent profile, add nickname/bio, and access follow states.
                  </p>
                </div>
              </div>
            ) : !profile ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-black border-t-transparent" />
              </div>
            ) : (
              <>
                {/* Save Feedback status messages */}
                {success && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-600 text-center font-medium">
                    {success}
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600 text-center font-medium">
                    {error}
                  </div>
                )}

                {/* Edit Form */}
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {/* Photo Edit */}
                  <div className="flex flex-col items-center space-y-2 text-center">
                    <div className="relative group cursor-pointer" onClick={() => editMode && fileInputRef.current?.click()}>
                      {profileImg ? (
                        <img
                          src={profileImg}
                          alt={profile.username}
                          className="h-24 w-24 rounded-3xl object-cover border-2 border-brand-black/15 shadow-md"
                        />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-brand-black text-white text-4xl font-extrabold shadow-md border-2 border-brand-black/15">
                          {profile.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {editMode && (
                        <div className="absolute inset-0 bg-black/60 rounded-3xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera size={20} />
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <div>
                      <h4 className="font-extrabold text-brand-black text-lg">{profile.nickname || profile.username}</h4>
                      <span className="text-xs text-brand-black/50">@{profile.username}</span>
                    </div>
                  </div>

                  {/* Follow counts */}
                  <div className="grid grid-cols-2 gap-4 border-y border-brand-gray-light py-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleTabClick('followers')}
                      className="group outline-none"
                    >
                      <span className="block text-lg font-extrabold text-brand-black group-hover:underline leading-none">{profile.followersCount}</span>
                      <span className="text-[10px] font-bold text-brand-black/40 uppercase tracking-wider mt-1.5 block">Followers</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabClick('following')}
                      className="group outline-none"
                    >
                      <span className="block text-lg font-extrabold text-brand-black group-hover:underline leading-none">{profile.followingCount}</span>
                      <span className="text-[10px] font-bold text-brand-black/40 uppercase tracking-wider mt-1.5 block">Following</span>
                    </button>
                  </div>

                  {/* Nickname Bio */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-brand-black/50">Nickname</label>
                      {editMode ? (
                        <input
                          type="text"
                          required
                          value={nickname}
                          onChange={(e) => setNickname(e.target.value)}
                          className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 px-4 text-xs text-brand-black outline-none transition-all focus:border-brand-black focus:bg-white"
                        />
                      ) : (
                        <span className="block text-xs font-semibold text-brand-black py-1.5">{profile.nickname || 'None set'}</span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-brand-black/50">Bio</label>
                      {editMode ? (
                        <textarea
                          rows={4}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Write something about yourself..."
                          className="w-full rounded-lg border border-brand-gray-mid/60 bg-brand-gray-light/30 py-2.5 px-4 text-xs text-brand-black outline-none transition-all focus:border-brand-black focus:bg-white resize-none"
                        />
                      ) : (
                        <p className="text-xs text-brand-black/85 leading-relaxed bg-brand-gray-light/20 rounded-xl p-3 border border-brand-gray-mid/20 min-h-16 whitespace-pre-wrap">
                          {profile.bio || 'No bio written yet.'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 pt-2">
                    {editMode ? (
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={saveLoading}
                          className="flex-1 rounded-xl bg-brand-black py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/90 active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                          {saveLoading ? 'Saving...' : 'Save Profile'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditMode(false);
                            setNickname(profile.nickname || '');
                            setBio(profile.bio || '');
                            setProfileImg(profile.profile_img || '');
                          }}
                          className="rounded-xl border border-brand-gray-mid/60 px-5 py-3 text-xs font-bold uppercase tracking-wider text-brand-black hover:bg-brand-gray-light cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditMode(true)}
                        className="w-full rounded-xl bg-brand-black py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-brand-black/95 active:scale-95 cursor-pointer"
                      >
                        Edit Profile
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}

            {/* Logout Option */}
            <div className="pt-6 border-t border-brand-gray-light shrink-0">
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full rounded-xl border border-red-200 bg-red-50/20 py-3 text-xs font-bold uppercase tracking-wider text-red-600 transition-all hover:bg-red-50 hover:text-red-700 active:scale-95 cursor-pointer text-center"
              >
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calling Notification overlay widget */}
      {callingState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-brand-gray-mid/30 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 animate-pulse">
              <PhoneCall size={24} />
            </div>
            
            <div className="space-y-1">
              <h4 className="font-extrabold text-brand-black text-lg">Calling @{callingState.targetUsername}</h4>
              <p className="text-xs text-brand-black/55">Waiting for peer to accept invitation...</p>
            </div>

            {callingState.status === 'accepted' ? (
              <div className="flex items-center justify-center gap-2 text-xs text-emerald-600 font-bold bg-emerald-50 py-2 rounded-xl">
                <Check size={14} /> Accepted! Connecting...
              </div>
            ) : (
              <button
                onClick={() => setCallingState(null)}
                className="w-full rounded-xl border border-brand-gray-mid/60 bg-white py-2.5 text-xs font-bold uppercase tracking-wider text-brand-black hover:bg-brand-gray-light transition-all cursor-pointer"
              >
                Cancel Call
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
