import { Track, Playlist, TrackSource } from '../types/music';
import { CustomThemeRecord } from '../types/themeLandscape';

const DB_NAME = 'SonicDroidDB';
const DB_VERSION = 3;

export interface StoredTrackRecord {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  url?: string;
  coverUrl?: string;
  isLocal: boolean;
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
  waveform?: number[];
  fileBlob?: Blob;
}

export interface TrackOverrideRecord {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  trackNumber?: number;
  folderPath?: string;
  genre?: string;
  lyrics?: string;
  coverUrl?: string;
  isFavorite?: boolean;
  playCount?: number;
  lastPlayedAt?: number;
  driveFileId?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('trackOverrides')) {
        db.createObjectStore('trackOverrides', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customThemes')) {
        db.createObjectStore('customThemes', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function saveLocalTrackToDB(track: Track): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const record: StoredTrackRecord = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      url: track.fileBlob ? undefined : track.url,
      coverUrl: track.coverUrl,
      isLocal: track.isLocal ?? true,
      dateAdded: track.dateAdded || Date.now(),
      genre: track.genre,
      year: track.year,
      trackNumber: track.trackNumber,
      folderPath: track.folderPath || 'Internal Storage/Download',
      playCount: track.playCount ?? 0,
      lastPlayedAt: track.lastPlayedAt,
      driveFileId: track.driveFileId,
      mimeType: track.mimeType,
      fileSize: track.fileSize,
      source: track.source || (track.driveFileId ? 'drive' : 'local'),
      isFavorite: !!track.isFavorite,
      lyrics: track.lyrics,
      waveform: track.waveform,
      fileBlob: track.fileBlob,
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLocalTracksFromDB(): Promise<Track[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', 'readonly');
      const store = tx.objectStore('tracks');
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result || []) as StoredTrackRecord[];
        const tracks: Track[] = records.map((rec) => {
          let url = rec.url || '';
          if (rec.fileBlob) {
            url = URL.createObjectURL(rec.fileBlob);
          }
          return {
            id: rec.id,
            title: rec.title,
            artist: rec.artist,
            album: rec.album,
            duration: rec.duration || 0,
            url,
            coverUrl: rec.coverUrl,
            isLocal: rec.isLocal,
            dateAdded: rec.dateAdded,
            genre: rec.genre,
            year: rec.year,
            trackNumber: rec.trackNumber,
            folderPath: rec.folderPath || 'Internal Storage/Music',
            playCount: rec.playCount ?? 0,
            lastPlayedAt: rec.lastPlayedAt,
            driveFileId: rec.driveFileId,
            mimeType: rec.mimeType,
            fileSize: rec.fileSize,
            source: rec.source || (rec.driveFileId ? 'drive' : 'local'),
            isFavorite: rec.isFavorite,
            lyrics: rec.lyrics,
            waveform: rec.waveform,
            fileBlob: rec.fileBlob,
          };
        });
        resolve(tracks);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error fetching local tracks from IndexedDB:', err);
    return [];
  }
}

export async function deleteLocalTrackFromDB(trackId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');
    const req = store.delete(trackId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveTrackOverrideToDB(override: TrackOverrideRecord): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('trackOverrides', 'readwrite');
    tx.objectStore('trackOverrides').put(override);
  } catch (err) {
    console.error('Failed to save track override:', err);
  }
}

export async function getAllTrackOverridesFromDB(): Promise<Record<string, TrackOverrideRecord>> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('trackOverrides', 'readonly');
      const req = tx.objectStore('trackOverrides').getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as TrackOverrideRecord[];
        const map: Record<string, TrackOverrideRecord> = {};
        list.forEach((item) => {
          map[item.id] = item;
        });
        resolve(map);
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}

export async function savePlaylistsToDB(playlists: Playlist[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('playlists', 'readwrite');
    const store = tx.objectStore('playlists');
    store.clear();
    playlists.forEach((p) => store.put(p));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPlaylistsFromDB(): Promise<Playlist[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as Playlist[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function saveSettingsToDB(key: string, value: unknown): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
  } catch (e) {
    console.error('Failed to save setting to DB', e);
  }
}

export async function getSettingFromDB<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => {
        if (req.result && req.result.value !== undefined) {
          resolve(req.result.value as T);
        } else {
          resolve(fallback);
        }
      };
      req.onerror = () => resolve(fallback);
    });
  } catch {
    return fallback;
  }
}

export async function saveCustomThemeToDB(theme: CustomThemeRecord): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customThemes', 'readwrite');
    const req = tx.objectStore('customThemes').put(theme);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCustomThemesFromDB(): Promise<CustomThemeRecord[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      if (!db.objectStoreNames.contains('customThemes')) {
        resolve([]);
        return;
      }
      const tx = db.transaction('customThemes', 'readonly');
      const req = tx.objectStore('customThemes').getAll();
      req.onsuccess = () => {
        const list = ((req.result || []) as CustomThemeRecord[]).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteCustomThemeFromDB(themeId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('customThemes', 'readwrite');
    const req = tx.objectStore('customThemes').delete(themeId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
