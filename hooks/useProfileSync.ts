import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

export interface ProfileData {
  username: string;
  nickname: string;
  bio: string;
  profile_img: string;
}

export function useProfileSync(
  socket: Socket | null,
  onProfileUpdated: (data: ProfileData) => void,
  onPeerProfileUpdated?: (data: ProfileData) => void
) {
  useEffect(() => {
    if (!socket) return;

    const handleProfileUpdated = (data: ProfileData) => {
      onProfileUpdated(data);
    };

    const handlePeerProfileUpdated = (data: ProfileData) => {
      if (onPeerProfileUpdated) {
        onPeerProfileUpdated(data);
      }
    };

    socket.on('profile_updated', handleProfileUpdated);
    socket.on('peer_profile_updated', handlePeerProfileUpdated);

    return () => {
      socket.off('profile_updated', handleProfileUpdated);
      socket.off('peer_profile_updated', handlePeerProfileUpdated);
    };
  }, [socket, onProfileUpdated, onPeerProfileUpdated]);
}
