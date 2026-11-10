export type TrackSource = 'curated' | 'local' | 'drive';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  url: string; // URL or ObjectURL
  coverUrl?: string;
  isLocal?: boolean;
  dateAdded: number;
  genre?: string;
  year?: string;
  trackNumber?: number;
  folderPath?: string;
  playCount?: number;
  lastPlayedAt?: number;
  driveFileId?: string;
  mimeType?: string;
  fileSize?: number;
  source?: TrackSource;
  isFavorite?: boolean;
  lyrics?: string;
  waveform?: number[]; // Normalized amplitude values (0-1) representing audio density
  fileBlob?: Blob; // stored in IndexedDB
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  trackIds: string[];
  coverUrl?: string;
  createdAt: number;
}

export type PlaybackMode = 'off' | 'repeat-all' | 'repeat-one';

export type VisualizerMode = 'neon-bars' | 'circular-wave' | 'liquid-wave' | 'galaxy-particles';

export type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'songs-asc'
  | 'songs-desc'
  | 'duration-asc'
  | 'duration-desc'
  | 'year-asc'
  | 'year-desc'
  | 'updated-asc'
  | 'updated-desc'
  | 'artist-asc'
  | 'artist-desc';

export interface EqualizerSettings {
  enabled: boolean;
  preamp: number; // dB (-12 to +12)
  bands: number[]; // 5 band values in dB (-12 to +12)
  bassBoost: number; // 0 to 100
  surround: boolean;
  preset: string;
}

export interface SleepTimerState {
  active: boolean;
  targetTimestamp: number | null;
  durationMinutes: number;
  stopAtTrackEnd: boolean;
}

export interface PrimeOneSettings {
  language: 'en' | 'es' | 'pt' | 'ja';
  showWaveforms: boolean;
  compactAlbumGrid: boolean;
  autoExtractArt: boolean;
  showCuratedTracks: boolean;
  gaplessPlayback: boolean;
  defaultPlaybackRate: number;
  headsetAutoPause: boolean;
  bluetoothAutoResume: boolean;
  enableNotifications: boolean;
  stickyNotification: boolean;
  enableLockScreenOverlay: boolean;
  keepScreenAwake: boolean;
}

export const DEFAULT_PRIME_ONE_SETTINGS: PrimeOneSettings = {
  language: 'en',
  showWaveforms: true,
  compactAlbumGrid: false,
  autoExtractArt: true,
  showCuratedTracks: true,
  gaplessPlayback: true,
  defaultPlaybackRate: 1.0,
  headsetAutoPause: true,
  bluetoothAutoResume: false,
  enableNotifications: true,
  stickyNotification: true,
  enableLockScreenOverlay: false,
  keepScreenAwake: false,
};
