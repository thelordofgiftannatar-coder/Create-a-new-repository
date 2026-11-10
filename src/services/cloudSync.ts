import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  Track,
  Playlist,
  EqualizerSettings,
  PrimeOneSettings,
  DEFAULT_PRIME_ONE_SETTINGS,
} from '../types/music';
import {
  DEFAULT_DIY_STYLE,
  DiyPlayerStyle,
  LandscapeThemeConfig,
} from '../types/themeLandscape';

const BUILTIN_THEME_IDS = new Set([
  'prime-one', 'absolute-dc', 'batman', 'justice-league', 'avengers', 'marvel',
  'medieval-times', 'forest', 'dnd', 'harry-potter', 'blade-runner',
  'cyberpunk-2077', 'dune', 'maze-runner', 'ghost-in-the-shell',
  'evangelion', 'vinland-saga', 'berserk',
]);

function sanitizeHexOrEmpty(val: unknown): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : '';
}

function sanitizeDiyStyleForCloud(raw?: DiyPlayerStyle): DiyPlayerStyle {
  const s = { ...DEFAULT_DIY_STYLE, ...(raw || {}) };
  return {
    iconPack: ['classic', 'comic', 'neon', 'duotone', 'thin'].includes(s.iconPack) ? s.iconPack : 'classic',
    iconShape: ['rounded', 'circle', 'sharp', 'soft'].includes(s.iconShape) ? s.iconShape : 'rounded',
    widgetStyle: ['docked-bar', 'floating-pill', 'glass-card', 'minimal-slim', 'vinyl-dock'].includes(s.widgetStyle)
      ? s.widgetStyle
      : 'docked-bar',
    widgetArtShape: ['rounded', 'circle', 'square'].includes(s.widgetArtShape) ? s.widgetArtShape : 'rounded',
    widgetOpacity: Math.max(0.3, Math.min(1, Number(s.widgetOpacity ?? 0.85))),
    widgetShowProgress: Boolean(s.widgetShowProgress),
    widgetShowFavorite: Boolean(s.widgetShowFavorite),
    screenStyle: ['obsidian-glass', 'amoled-black', 'comic-panel', 'neon-hud', 'borderless-air'].includes(s.screenStyle)
      ? s.screenStyle
      : 'obsidian-glass',
    cardRadius: ['sharp', 'rounded', 'pill'].includes(s.cardRadius) ? s.cardRadius : 'rounded',
    heroArtMode: ['poster', 'framed', 'vinyl', 'aurora-halo'].includes(s.heroArtMode) ? s.heroArtMode : 'poster',
    customPrimaryHex: sanitizeHexOrEmpty(s.customPrimaryHex),
    customSecondaryHex: sanitizeHexOrEmpty(s.customSecondaryHex),
    customSurfaceHex: sanitizeHexOrEmpty(s.customSurfaceHex),
    overlayEffectOverride: s.overlayEffectOverride || 'theme-default',
    effectIntensity: Math.max(0.2, Math.min(2, Number(s.effectIntensity ?? 1.0))),
    glowIntensity: Math.max(0, Math.min(1, Number(s.glowIntensity ?? 0.35))),
  };
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

function clampString(val: unknown, max: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.slice(0, max);
}

/**
 * Ensures coverUrl stays within Firestore limits (<= 240KB).
 */
function sanitizeCoverUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('blob:')) return undefined; // ObjectURLs aren't valid across devices
  if (url.length > 240000) return undefined;
  return url;
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: clampString(user.displayName || user.email?.split('@')[0] || 'Prime One Listener', 120),
        ...(user.email ? { email: clampString(user.email, 254) } : {}),
        ...(user.photoURL ? { photoURL: clampString(user.photoURL, 2048) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: clampString(user.displayName || user.email?.split('@')[0] || 'Prime One Listener', 120),
        ...(user.email ? { email: clampString(user.email, 254) } : {}),
        ...(user.photoURL ? { photoURL: clampString(user.photoURL, 2048) } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncTrackToCloud(uid: string, track: Track): Promise<void> {
  const safeId = sanitizeId(track.id);
  const path = `users/${uid}/tracks/${safeId}`;
  const ref = doc(db, 'users', uid, 'tracks', safeId);

  const safeCover = sanitizeCoverUrl(track.coverUrl);
  const safeWaveform = Array.isArray(track.waveform)
    ? track.waveform.slice(0, 64).map((n) => (Number.isFinite(n) ? Number(n) : 0.3))
    : undefined;

  const basePayload: Record<string, unknown> = {
    title: clampString(track.title || 'Untitled Track', 200, 'Untitled Track'),
    artist: clampString(track.artist || 'Unknown Artist', 200, 'Unknown Artist'),
    album: clampString(track.album || 'Prime One Library', 200, 'Prime One Library'),
    duration: Number.isFinite(track.duration) ? Math.max(0, Math.min(86400, track.duration)) : 0,
    source: track.source || (track.driveFileId ? 'drive' : track.isLocal ? 'local' : 'curated'),
    dateAdded: Number.isFinite(track.dateAdded) ? track.dateAdded : Date.now(),
    isFavorite: Boolean(track.isFavorite),
    playCount: Math.max(0, Math.floor(track.playCount || 0)),
    ...(track.lastPlayedAt ? { lastPlayedAt: track.lastPlayedAt } : {}),
    ...(track.year !== undefined ? { year: clampString(track.year, 12) } : {}),
    ...(track.trackNumber !== undefined && Number.isFinite(track.trackNumber)
      ? { trackNumber: Math.max(0, Math.min(9999, Math.floor(track.trackNumber))) }
      : {}),
    ...(track.folderPath !== undefined ? { folderPath: clampString(track.folderPath, 300) } : {}),
    ...(track.genre !== undefined ? { genre: clampString(track.genre, 80) } : {}),
    ...(track.lyrics !== undefined ? { lyrics: clampString(track.lyrics, 25000) } : {}),
    ...(safeCover ? { coverUrl: safeCover } : {}),
    ...(safeWaveform ? { waveform: safeWaveform } : {}),
    ...(track.driveFileId ? { driveFileId: clampString(track.driveFileId, 256) } : {}),
    ...(track.mimeType ? { mimeType: clampString(track.mimeType, 120) } : {}),
    ...(track.fileSize !== undefined ? { fileSize: Math.max(0, Math.floor(track.fileSize)) } : {}),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: safeId,
        ownerId: uid,
        ...basePayload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, basePayload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCloudTrack(uid: string, trackId: string): Promise<void> {
  const safeId = sanitizeId(trackId);
  const path = `users/${uid}/tracks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'tracks', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncPlaylistToCloud(uid: string, playlist: Playlist): Promise<void> {
  const safeId = sanitizeId(playlist.id);
  const path = `users/${uid}/playlists/${safeId}`;
  const ref = doc(db, 'users', uid, 'playlists', safeId);

  const safeCover = sanitizeCoverUrl(playlist.coverUrl);
  const safeTrackIds = playlist.trackIds.slice(0, 500).map((id) => sanitizeId(id));

  const payload: Record<string, unknown> = {
    name: clampString(playlist.name || 'Untitled Playlist', 120, 'Untitled Playlist'),
    trackIds: safeTrackIds,
    ...(playlist.description !== undefined
      ? { description: clampString(playlist.description, 500) }
      : {}),
    ...(safeCover ? { coverUrl: safeCover } : {}),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: safeId,
        ownerId: uid,
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCloudPlaylist(uid: string, playlistId: string): Promise<void> {
  const safeId = sanitizeId(playlistId);
  const path = `users/${uid}/playlists/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'playlists', safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function syncPreferencesToCloud(
  uid: string,
  eq: EqualizerSettings,
  landscape: LandscapeThemeConfig,
  playerSettings: PrimeOneSettings
): Promise<void> {
  const path = `users/${uid}/preferences/main`;
  const ref = doc(db, 'users', uid, 'preferences', 'main');

  // Keep only remote URL wallpapers on built-in theme IDs
  const themeWallpaperUrls: Record<string, { mediaType: 'image' | 'video'; url: string }> = {};
  Object.entries(landscape.themeWallpapers || {}).forEach(([themeKey, val]) => {
    if (
      BUILTIN_THEME_IDS.has(themeKey) &&
      val &&
      typeof val.url === 'string' &&
      !val.url.startsWith('data:') &&
      val.url.length <= 2048
    ) {
      themeWallpaperUrls[themeKey] = {
        mediaType: val.mediaType,
        url: val.url,
      };
    }
  });

  const payload: Record<string, unknown> = {
    eqEnabled: Boolean(eq.enabled),
    eqPreamp: Math.max(-24, Math.min(24, Number(eq.preamp || 0))),
    eqBands: [0, 1, 2, 3, 4].map((i) => Math.max(-24, Math.min(24, Number(eq.bands[i] ?? 0)))),
    eqBassBoost: Math.max(0, Math.min(100, Number(eq.bassBoost || 0))),
    eqSurround: Boolean(eq.surround),
    eqPreset: clampString(eq.preset || 'flat', 64, 'flat'),
    activeThemeId: clampString(landscape.activeThemeId || 'prime-one', 64, 'prime-one'),
    enableAtmosphericEffects: Boolean(landscape.enableAtmosphericEffects),
    blur: Math.max(0, Math.min(30, Number(landscape.blur || 0))),
    dim: Math.max(0, Math.min(1, Number(landscape.dim ?? 0.38))),
    extraVignette: Boolean(landscape.extraVignette),
    useAlbumArtFallback: Boolean(landscape.useAlbumArtFallback),
    themeWallpaperUrls,
    diyStyle: sanitizeDiyStyleForCloud(landscape.diyStyle),
    language: clampString(playerSettings.language || 'en', 16, 'en'),
    showWaveforms: Boolean(playerSettings.showWaveforms),
    headsetAutoPause: Boolean(playerSettings.headsetAutoPause),
    enableLockScreenOverlay: Boolean(playerSettings.enableLockScreenOverlay),
    enableNotifications: Boolean(playerSettings.enableNotifications),
    showCuratedTracks: Boolean(playerSettings.showCuratedTracks),
    keepScreenAwake: Boolean(playerSettings.keepScreenAwake),
    autoExtractArt: Boolean(playerSettings.autoExtractArt),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: 'main',
        ownerId: uid,
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export interface CloudSyncCallbacks {
  onCloudTracks: (cloudTracks: Partial<Track>[]) => void;
  onCloudPlaylists: (playlists: Playlist[]) => void;
  onCloudPreferences: (prefs: {
    eq?: EqualizerSettings;
    landscape?: Partial<LandscapeThemeConfig>;
    playerSettings?: Partial<PrimeOneSettings>;
  }) => void;
}

export function subscribeToCloudSync(
  uid: string,
  callbacks: CloudSyncCallbacks
): () => void {
  const unsubscribers: Unsubscribe[] = [];

  // 1. Sync Tracks (queries strictly constrained by ownerId == uid)
  const tracksPath = `users/${uid}/tracks`;
  const tracksQuery = query(collection(db, 'users', uid, 'tracks'), where('ownerId', '==', uid));
  unsubscribers.push(
    onSnapshot(
      tracksQuery,
      (snapshot) => {
        const list: Partial<Track>[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            title: data.title,
            artist: data.artist,
            album: data.album,
            duration: data.duration,
            source: data.source,
            dateAdded: data.dateAdded,
            year: data.year,
            trackNumber: data.trackNumber,
            folderPath: data.folderPath,
            genre: data.genre,
            lyrics: data.lyrics,
            coverUrl: data.coverUrl,
            isFavorite: data.isFavorite,
            playCount: data.playCount,
            lastPlayedAt: data.lastPlayedAt,
            waveform: data.waveform,
            driveFileId: data.driveFileId,
            mimeType: data.mimeType,
            fileSize: data.fileSize,
          };
        });
        callbacks.onCloudTracks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, tracksPath)
    )
  );

  // 2. Sync Playlists
  const playlistsPath = `users/${uid}/playlists`;
  const playlistsQuery = query(
    collection(db, 'users', uid, 'playlists'),
    where('ownerId', '==', uid)
  );
  unsubscribers.push(
    onSnapshot(
      playlistsQuery,
      (snapshot) => {
        const list: Playlist[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: data.id,
            name: data.name,
            description: data.description,
            trackIds: Array.isArray(data.trackIds) ? data.trackIds : [],
            coverUrl: data.coverUrl,
            createdAt:
              typeof data.createdAt?.toMillis === 'function'
                ? data.createdAt.toMillis()
                : Date.now(),
          };
        });
        callbacks.onCloudPlaylists(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, playlistsPath)
    )
  );

  // 3. Sync UserPreferences
  const prefsPath = `users/${uid}/preferences/main`;
  const prefsRef = doc(db, 'users', uid, 'preferences', 'main');
  unsubscribers.push(
    onSnapshot(
      prefsRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        callbacks.onCloudPreferences({
          eq: {
            enabled: Boolean(d.eqEnabled),
            preamp: Number(d.eqPreamp || 0),
            bands: Array.isArray(d.eqBands) && d.eqBands.length === 5 ? d.eqBands : [0, 0, 0, 0, 0],
            bassBoost: Number(d.eqBassBoost || 0),
            surround: Boolean(d.eqSurround),
            preset: String(d.eqPreset || 'flat'),
          },
          landscape: {
            activeThemeId: d.activeThemeId,
            enableAtmosphericEffects: d.enableAtmosphericEffects,
            blur: d.blur,
            dim: d.dim,
            extraVignette: d.extraVignette,
            useAlbumArtFallback: d.useAlbumArtFallback,
            ...(d.themeWallpaperUrls ? { themeWallpapers: d.themeWallpaperUrls } : {}),
            ...(d.diyStyle ? { diyStyle: sanitizeDiyStyleForCloud(d.diyStyle) } : {}),
          } as Partial<LandscapeThemeConfig>,
          playerSettings: {
            ...DEFAULT_PRIME_ONE_SETTINGS,
            ...(d.language ? { language: d.language } : {}),
            ...(typeof d.showWaveforms === 'boolean' ? { showWaveforms: d.showWaveforms } : {}),
            ...(typeof d.headsetAutoPause === 'boolean'
              ? { headsetAutoPause: d.headsetAutoPause }
              : {}),
            ...(typeof d.enableLockScreenOverlay === 'boolean'
              ? { enableLockScreenOverlay: d.enableLockScreenOverlay }
              : {}),
            ...(typeof d.enableNotifications === 'boolean'
              ? { enableNotifications: d.enableNotifications }
              : {}),
            ...(typeof d.showCuratedTracks === 'boolean'
              ? { showCuratedTracks: d.showCuratedTracks }
              : {}),
            ...(typeof d.keepScreenAwake === 'boolean'
              ? { keepScreenAwake: d.keepScreenAwake }
              : {}),
            ...(typeof d.autoExtractArt === 'boolean' ? { autoExtractArt: d.autoExtractArt } : {}),
          },
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, prefsPath)
    )
  );

  return () => {
    unsubscribers.forEach((u) => u());
  };
}
