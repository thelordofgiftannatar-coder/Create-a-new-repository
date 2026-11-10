import { Track } from '../types/music';

export type PermissionKey =
  | 'music_audio'
  | 'photos_videos'
  | 'notifications'
  | 'background_playback'
  | 'cloud_account';

export type PermissionStatus = 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface PermissionSummary {
  notifications: PermissionStatus;
  persistentStorage: PermissionStatus;
  wakeLock: PermissionStatus;
  mediaSession: PermissionStatus;
}

export async function getPermissionSummary(): Promise<PermissionSummary> {
  let notifications: PermissionStatus = 'unsupported';
  if (typeof window !== 'undefined' && 'Notification' in window) {
    notifications = Notification.permission as PermissionStatus;
  }

  let persistentStorage: PermissionStatus = 'prompt';
  if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
    try {
      const persisted = await navigator.storage.persisted();
      persistentStorage = persisted ? 'granted' : 'prompt';
    } catch {
      persistentStorage = 'prompt';
    }
  } else {
    persistentStorage = 'unsupported';
  }

  const wakeLock: PermissionStatus =
    typeof navigator !== 'undefined' && 'wakeLock' in navigator ? 'granted' : 'unsupported';

  const mediaSession: PermissionStatus =
    typeof navigator !== 'undefined' && 'mediaSession' in navigator ? 'granted' : 'unsupported';

  return {
    notifications,
    persistentStorage,
    wakeLock,
    mediaSession,
  };
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result as PermissionStatus;
  } catch {
    return 'denied';
  }
}

export async function requestPersistentAudioStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Show or update persistent media notification on Android / PWA background playback
 * via active Service Worker registration (falls back cleanly to Web Notification API).
 */
export async function updateBackgroundMediaNotification(
  track: Track | null,
  isPlaying: boolean,
  enabled: boolean
): Promise<void> {
  if (!enabled || !track) return;
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const title = isPlaying ? `▶ ${track.title}` : `❚❚ ${track.title}`;
  const body = `${track.artist}${track.album ? ` — ${track.album}` : ''} • Prime One`;
  const icon = track.coverUrl && !track.coverUrl.startsWith('blob:') ? track.coverUrl : '/pwa-192x192.png';

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon,
          badge: '/pwa-192x192.png',
          tag: 'prime-one-now-playing',
          silent: true,
          requireInteraction: isPlaying,
          data: { trackId: track.id, isPlaying },
          actions: [
            { action: 'prev', title: '⏮ Prev' },
            { action: 'play_pause', title: isPlaying ? '❚❚ Pause' : '▶ Play' },
            { action: 'next', title: '⏭ Next' },
          ],
        } as NotificationOptions & { actions?: Array<{ action: string; title: string }> });
        return;
      }
    }

    // Fallback Notification
    new Notification(title, {
      body,
      icon,
      tag: 'prime-one-now-playing',
      silent: true,
    });
  } catch (err) {
    console.warn('Media notification update skipped:', err);
  }
}

export async function clearMediaNotification(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const list = await reg.getNotifications({ tag: 'prime-one-now-playing' });
        list.forEach((n) => n.close());
      }
    }
  } catch {
    // Ignore
  }
}
