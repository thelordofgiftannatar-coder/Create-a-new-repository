/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Music,
  PlayCircle,
  Library,
  Folder,
  User as UserIcon,
  Tag,
  Disc,
  Search,
  MoreVertical,
  ListStart,
  Sliders,
  Moon,
  RefreshCw,
  Settings,
  HelpCircle,
  Power,
  Image as ImageIcon,
  Cloud,
  FolderOpen,
  Play,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AudioLines,
  FolderArchive,
  FileCode2,
  FileText,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  Track,
  Playlist,
  EqualizerSettings,
  PlaybackMode,
  SleepTimerState,
  SortOption,
  PrimeOneSettings,
  DEFAULT_PRIME_ONE_SETTINGS,
} from './types/music';
import {
  CustomThemeRecord,
  DEFAULT_DIY_STYLE,
  LANDSCAPE_THEMES,
  LandscapeThemeConfig,
  DEFAULT_LANDSCAPE_CONFIG,
} from './types/themeLandscape';
import { INITIAL_TRACKS } from './services/curatedTracks';
import { audioEngine, triggerHaptic } from './services/audioEngine';
import {
  getAllLocalTracksFromDB,
  saveLocalTrackToDB,
  deleteLocalTrackFromDB,
  getAllTrackOverridesFromDB,
  saveTrackOverrideToDB,
  getPlaylistsFromDB,
  savePlaylistsToDB,
  getSettingFromDB,
  saveSettingsToDB,
  getAllCustomThemesFromDB,
  saveCustomThemeToDB,
  deleteCustomThemeFromDB,
  TrackOverrideRecord,
} from './services/db';
import {
  initAuth,
  testFirestoreConnection,
} from './services/firebase';
import {
  ensureUserProfile,
  syncTrackToCloud,
  deleteCloudTrack,
  syncPlaylistToCloud,
  deleteCloudPlaylist,
  syncPreferencesToCloud,
  subscribeToCloudSync,
} from './services/cloudSync';
import {
  downloadDriveFileAsBlob,
  PrimeOneCloudBackup,
} from './services/googleWorkspace';
import {
  updateBackgroundMediaNotification,
  clearMediaNotification,
} from './services/permissionsService';
import {
  downloadGitHubAppZip,
  downloadStandaloneHtml,
  downloadWorkflowYaml,
} from './services/githubExport';

// Components
import { ExpandablePlayerSheet } from './components/ExpandablePlayerSheet';
import { FastScroller } from './components/FastScroller';
import { GeminiStudioModal } from './components/GeminiStudioModal';
import { EqualizerModal } from './components/EqualizerModal';
import { SleepTimerModal } from './components/SleepTimerModal';
import { FileImporter } from './components/FileImporter';
import { AmbientGeneratorModal } from './components/AmbientGeneratorModal';
import { PlaylistModal } from './components/PlaylistModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ThemeLandscapeModal } from './components/ThemeLandscapeModal';
import { WallpaperBackground } from './components/WallpaperBackground';
import { SortModal } from './components/SortModal';
import { TagEditorModal } from './components/TagEditorModal';
import { CloudDriveModal } from './components/CloudDriveModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpInfoModal } from './components/HelpInfoModal';
import { LockScreenOverlay } from './components/LockScreenOverlay';
import { ConfirmActionModal, ConfirmActionConfig } from './components/ConfirmActionModal';
import { TrackListItem } from './components/TrackListItem';
import { FoldersView } from './components/FoldersView';
import { PlaylistsLibraryView } from './components/PlaylistsLibraryView';
import { AlbumsGridView } from './components/AlbumsGridView';
import { ArtistsView } from './components/ArtistsView';
import { QueueView } from './components/QueueView';
import { TagsManagerView } from './components/TagsManagerView';

const DEFAULT_EQ: EqualizerSettings = {
  enabled: true,
  preamp: 0,
  bands: [3, 2, 0, 1, 3],
  bassBoost: 30,
  surround: false,
  preset: 'electronic',
};

const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'fav-playlist',
    name: 'Top Favorites',
    trackIds: ['demo-1', 'demo-3'],
    createdAt: Date.now(),
  },
  {
    id: 'chill-playlist',
    name: 'Late Night Chill',
    trackIds: ['demo-1', 'demo-4'],
    createdAt: Date.now(),
  },
];

type NavTab = 'queue' | 'library' | 'folders' | 'artists' | 'tags' | 'albums' | 'songs';

export default function App() {
  // Auth & Cloud Workspace State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsWorkspaceReauth, setNeedsWorkspaceReauth] = useState(false);

  // Core Library Data
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const [cloudOnlyTracks, setCloudOnlyTracks] = useState<Partial<Track>[]>([]);
  const [overrides, setOverrides] = useState<Record<string, TrackOverrideRecord>>({});
  const [playlists, setPlaylists] = useState<Playlist[]>(DEFAULT_PLAYLISTS);

  // Playback & Queue
  const [currentTrack, setCurrentTrack] = useState<Track | null>(INITIAL_TRACKS[0]);
  const [queueIds, setQueueIds] = useState<string[]>(INITIAL_TRACKS.map((t) => t.id));
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('repeat-all');
  const [isShuffle, setIsShuffle] = useState(false);

  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState<NavTab>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');

  // Menus & Modals
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isEQOpen, setIsEQOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [isAmbientOpen, setIsAmbientOpen] = useState(false);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isLandscapeModalOpen, setIsLandscapeModalOpen] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [editingTagTrack, setEditingTagTrack] = useState<Track | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isLockScreenOpen, setIsLockScreenOpen] = useState(false);
  const [isGeminiStudioOpen, setIsGeminiStudioOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmActionConfig | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Non-blocking toast banner
  const [toast, setToast] = useState<{ msg: string; kind?: 'info' | 'error' } | null>(null);

  // Preferences & Config
  const [eqSettings, setEqSettings] = useState<EqualizerSettings>(DEFAULT_EQ);
  const [landscapeConfig, setLandscapeConfig] =
    useState<LandscapeThemeConfig>(DEFAULT_LANDSCAPE_CONFIG);
  const [customThemes, setCustomThemes] = useState<CustomThemeRecord[]>([]);
  const [playerSettings, setPlayerSettings] =
    useState<PrimeOneSettings>(DEFAULT_PRIME_ONE_SETTINGS);
  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({
    active: false,
    targetTimestamp: null,
    durationMinutes: 0,
    stopAtTrackEnd: false,
  });

  const showToast = useCallback((msg: string, kind: 'info' | 'error' = 'info') => {
    setToast({ msg, kind });
    setTimeout(() => {
      setToast((prev) => (prev?.msg === msg ? null : prev));
    }, 4000);
  }, []);

  // Merge Local + Curated + Cloud metadata overrides cleanly
  const tracks = useMemo<Track[]>(() => {
    const baseCurated = playerSettings.showCuratedTracks ? INITIAL_TRACKS : [];
    const seenIds = new Set<string>();
    const combined: Track[] = [];

    const mergeWithOverride = (tr: Track): Track => {
      const ov = overrides[tr.id];
      if (!ov) return tr;
      return {
        ...tr,
        ...(ov.title !== undefined ? { title: ov.title } : {}),
        ...(ov.artist !== undefined ? { artist: ov.artist } : {}),
        ...(ov.album !== undefined ? { album: ov.album } : {}),
        ...(ov.year !== undefined ? { year: ov.year } : {}),
        ...(ov.trackNumber !== undefined ? { trackNumber: ov.trackNumber } : {}),
        ...(ov.folderPath !== undefined ? { folderPath: ov.folderPath } : {}),
        ...(ov.genre !== undefined ? { genre: ov.genre } : {}),
        ...(ov.lyrics !== undefined ? { lyrics: ov.lyrics } : {}),
        ...(ov.coverUrl !== undefined ? { coverUrl: ov.coverUrl } : {}),
        ...(ov.isFavorite !== undefined ? { isFavorite: ov.isFavorite } : {}),
        ...(ov.playCount !== undefined ? { playCount: ov.playCount } : {}),
        ...(ov.lastPlayedAt !== undefined ? { lastPlayedAt: ov.lastPlayedAt } : {}),
        ...(ov.driveFileId !== undefined ? { driveFileId: ov.driveFileId } : {}),
      };
    };

    localTracks.forEach((tr) => {
      seenIds.add(tr.id);
      combined.push(mergeWithOverride(tr));
    });

    baseCurated.forEach((tr) => {
      if (!seenIds.has(tr.id)) {
        seenIds.add(tr.id);
        combined.push(mergeWithOverride(tr));
      }
    });

    cloudOnlyTracks.forEach((ct) => {
      if (ct.id && !seenIds.has(ct.id) && ct.driveFileId) {
        seenIds.add(ct.id);
        combined.push(
          mergeWithOverride({
            id: ct.id,
            title: ct.title || 'Cloud Track',
            artist: ct.artist || 'Google Drive',
            album: ct.album || 'Prime One Cloud',
            duration: ct.duration || 180,
            url: '',
            coverUrl: ct.coverUrl,
            isLocal: false,
            source: 'drive',
            dateAdded: ct.dateAdded || Date.now(),
            genre: ct.genre,
            year: ct.year,
            trackNumber: ct.trackNumber,
            folderPath: ct.folderPath || 'Google Drive/Prime One Music',
            playCount: ct.playCount || 0,
            lastPlayedAt: ct.lastPlayedAt,
            driveFileId: ct.driveFileId,
            mimeType: ct.mimeType,
            fileSize: ct.fileSize,
            isFavorite: ct.isFavorite,
            lyrics: ct.lyrics,
            waveform: ct.waveform,
          })
        );
      }
    });

    return combined;
  }, [localTracks, cloudOnlyTracks, overrides, playerSettings.showCuratedTracks]);

  const queueTracks = useMemo<Track[]>(() => {
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const resolved = queueIds
      .map((id) => byId.get(id))
      .filter((t): t is Track => Boolean(t));
    return resolved.length > 0 ? resolved : tracks;
  }, [queueIds, tracks]);

  // Keep currentTrack synced with latest tag edits / cover art edits
  useEffect(() => {
    if (!currentTrack) return;
    const latest = tracks.find((t) => t.id === currentTrack.id);
    if (latest) {
      setCurrentTrack(latest);
      audioEngine.refreshMediaSessionMetadata(latest);
    }
  }, [tracks]);

  // Initial IndexedDB load + Firebase Auth + Connectivity Check
  useEffect(() => {
    testFirestoreConnection();

    async function loadInitialLocalData() {
      try {
        const [
          storedLocal,
          storedOverrides,
          storedPlaylists,
          storedEQ,
          storedLandscape,
          storedPlayerSettings,
          storedCustomThemes,
        ] = await Promise.all([
          getAllLocalTracksFromDB(),
          getAllTrackOverridesFromDB(),
          getPlaylistsFromDB(),
          getSettingFromDB<EqualizerSettings>('eqSettings', DEFAULT_EQ),
          getSettingFromDB<LandscapeThemeConfig>(
            'landscapeThemeConfig',
            DEFAULT_LANDSCAPE_CONFIG
          ),
          getSettingFromDB<PrimeOneSettings>(
            'primeOneSettings',
            DEFAULT_PRIME_ONE_SETTINGS
          ),
          getAllCustomThemesFromDB(),
        ]);

        if (storedLocal.length > 0) setLocalTracks(storedLocal);
        if (Object.keys(storedOverrides).length > 0) setOverrides(storedOverrides);
        if (storedPlaylists.length > 0) setPlaylists(storedPlaylists);
        if (storedCustomThemes.length > 0) setCustomThemes(storedCustomThemes);

        setEqSettings(storedEQ);
        audioEngine.applyEqualizer(storedEQ);

        setLandscapeConfig(storedLandscape);
        setPlayerSettings(storedPlayerSettings);
        audioEngine.setPlaybackRate(storedPlayerSettings.defaultPlaybackRate || 1.0);
      } catch (err) {
        console.warn('Initial storage load note:', err);
      }
    }
    loadInitialLocalData();

    const unsubAuth = initAuth(({ user: authUser, accessToken: tok, needsWorkspaceReauth: reauth }) => {
      setUser(authUser);
      setAccessToken(tok);
      setNeedsWorkspaceReauth(reauth);
    });

    return () => unsubAuth();
  }, []);

  // Firestore real-time cloud subscription when signed in
  const cloudUnsubRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (cloudUnsubRef.current) {
      cloudUnsubRef.current();
      cloudUnsubRef.current = null;
    }

    if (!user) {
      setCloudOnlyTracks([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await ensureUserProfile(user);
        if (cancelled) return;
        const unsub = subscribeToCloudSync(user.uid, {
          onCloudTracks: (cloudItems) => {
            setCloudOnlyTracks(cloudItems);
            setOverrides((prev) => {
              const next = { ...prev };
              cloudItems.forEach((ct) => {
                if (!ct.id) return;
                next[ct.id] = {
                  ...next[ct.id],
                  id: ct.id,
                  ...(ct.title ? { title: ct.title } : {}),
                  ...(ct.artist ? { artist: ct.artist } : {}),
                  ...(ct.album ? { album: ct.album } : {}),
                  ...(ct.year !== undefined ? { year: ct.year } : {}),
                  ...(ct.trackNumber !== undefined ? { trackNumber: ct.trackNumber } : {}),
                  ...(ct.folderPath !== undefined ? { folderPath: ct.folderPath } : {}),
                  ...(ct.genre !== undefined ? { genre: ct.genre } : {}),
                  ...(ct.lyrics !== undefined ? { lyrics: ct.lyrics } : {}),
                  ...(ct.coverUrl !== undefined ? { coverUrl: ct.coverUrl } : {}),
                  ...(ct.isFavorite !== undefined ? { isFavorite: ct.isFavorite } : {}),
                  ...(ct.playCount !== undefined ? { playCount: ct.playCount } : {}),
                  ...(ct.lastPlayedAt !== undefined ? { lastPlayedAt: ct.lastPlayedAt } : {}),
                  ...(ct.driveFileId !== undefined ? { driveFileId: ct.driveFileId } : {}),
                };
              });
              return next;
            });
          },
          onCloudPlaylists: (cloudPl) => {
            if (cloudPl.length > 0) {
              setPlaylists(cloudPl);
              savePlaylistsToDB(cloudPl);
            }
          },
          onCloudPreferences: (prefs) => {
            if (prefs.eq) {
              setEqSettings(prefs.eq);
              audioEngine.applyEqualizer(prefs.eq);
              saveSettingsToDB('eqSettings', prefs.eq);
            }
            if (prefs.landscape) {
              setLandscapeConfig((prev) => {
                const merged: LandscapeThemeConfig = {
                  ...prev,
                  ...prefs.landscape,
                  themeWallpapers: {
                    ...prev.themeWallpapers,
                    ...(prefs.landscape?.themeWallpapers || {}),
                  },
                };
                saveSettingsToDB('landscapeThemeConfig', merged);
                return merged;
              });
            }
            if (prefs.playerSettings) {
              setPlayerSettings((prev) => {
                const merged = { ...prev, ...prefs.playerSettings };
                saveSettingsToDB('primeOneSettings', merged);
                return merged;
              });
            }
          },
        });
        cloudUnsubRef.current = unsub;
      } catch (err) {
        console.warn('Cloud sync setup warning:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (cloudUnsubRef.current) {
        cloudUnsubRef.current();
        cloudUnsubRef.current = null;
      }
    };
  }, [user]);

  // Playback progress loop for waveforms
  useEffect(() => {
    const interval = setInterval(() => {
      const cur = audioEngine.getCurrentTime();
      const dur = audioEngine.getDuration();
      if (dur > 0) {
        setPlaybackProgress(cur / dur);
      }
    }, 350);
    return () => clearInterval(interval);
  }, []);

  // Update background notification when track or playing state changes
  useEffect(() => {
    if (playerSettings.enableNotifications && currentTrack) {
      updateBackgroundMediaNotification(currentTrack, isPlaying, true);
    }
  }, [currentTrack?.id, currentTrack?.title, currentTrack?.coverUrl, isPlaying, playerSettings.enableNotifications]);

  // Keep Screen Awake when configured globally
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    if (playerSettings.keepScreenAwake && isPlaying && 'wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((s) => {
          sentinel = s;
        })
        .catch(() => {});
    }
    return () => {
      if (sentinel) sentinel.release().catch(() => {});
    };
  }, [playerSettings.keepScreenAwake, isPlaying]);

  // Record playCount + lastPlayedAt + hydrate Drive binary if needed
  const handleSelectTrack = useCallback(
    async (track: Track) => {
      triggerHaptic(20);
      let playableTrack = track;

      // Download Drive binary if track is cloud-only and lacks URL
      if (!playableTrack.url && playableTrack.driveFileId) {
        if (!accessToken) {
          showToast('Connect Google Drive to stream this cloud track.', 'error');
          setIsCloudModalOpen(true);
          return;
        }
        try {
          showToast(`Downloading "${playableTrack.title}" from Google Drive...`);
          const blob = await downloadDriveFileAsBlob(accessToken, playableTrack.driveFileId);
          const url = URL.createObjectURL(blob);
          playableTrack = { ...playableTrack, url, fileBlob: blob, isLocal: true };
          await saveLocalTrackToDB(playableTrack);
          setLocalTracks((prev) => [
            playableTrack,
            ...prev.filter((t) => t.id !== playableTrack.id),
          ]);
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'Could not stream Drive audio file.',
            'error'
          );
          return;
        }
      }

      const now = Date.now();
      const nextCount = (playableTrack.playCount || 0) + 1;
      const updatedTrack: Track = {
        ...playableTrack,
        playCount: nextCount,
        lastPlayedAt: now,
      };

      setCurrentTrack(updatedTrack);
      audioEngine.playTrack(updatedTrack);
      setIsPlaying(true);

      // Persist playCount locally & to cloud
      const ov: TrackOverrideRecord = {
        ...overrides[updatedTrack.id],
        id: updatedTrack.id,
        playCount: nextCount,
        lastPlayedAt: now,
      };
      setOverrides((prev) => ({ ...prev, [updatedTrack.id]: ov }));
      saveTrackOverrideToDB(ov);
      if (updatedTrack.isLocal) saveLocalTrackToDB(updatedTrack);
      if (user) {
        syncTrackToCloud(user.uid, updatedTrack).catch(() => {});
      }
    },
    [accessToken, overrides, user, showToast]
  );

  // Next / Prev / Ended handlers
  const handleNextTrack = useCallback(() => {
    triggerHaptic(15);
    const pool = queueTracks.length > 0 ? queueTracks : tracks;
    if (pool.length === 0) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * pool.length);
      handleSelectTrack(pool[randomIndex]);
      return;
    }

    const currentIndex = pool.findIndex((t) => t.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % pool.length;
    handleSelectTrack(pool[nextIndex]);
  }, [queueTracks, tracks, currentTrack, isShuffle, handleSelectTrack]);

  const handlePrevTrack = useCallback(() => {
    triggerHaptic(15);
    const pool = queueTracks.length > 0 ? queueTracks : tracks;
    if (pool.length === 0) return;

    if (audioEngine.getCurrentTime() > 3) {
      audioEngine.seek(0);
      return;
    }

    const currentIndex = pool.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = (currentIndex - 1 + pool.length) % pool.length;
    handleSelectTrack(pool[prevIndex]);
  }, [queueTracks, tracks, currentTrack, handleSelectTrack]);

  const handleTrackEnded = useCallback(() => {
    if (playbackMode === 'repeat-one' && currentTrack) {
      audioEngine.seek(0);
      audioEngine.playTrack(currentTrack);
      setIsPlaying(true);
      return;
    }

    if (sleepTimer.active && sleepTimer.stopAtTrackEnd) {
      audioEngine.pause();
      setIsPlaying(false);
      setSleepTimer({
        active: false,
        targetTimestamp: null,
        durationMinutes: 0,
        stopAtTrackEnd: false,
      });
      return;
    }

    handleNextTrack();
  }, [playbackMode, currentTrack, sleepTimer, handleNextTrack]);

  const handleTogglePlay = useCallback(() => {
    triggerHaptic(20);
    if (!currentTrack) {
      if (tracks.length > 0) handleSelectTrack(tracks[0]);
      return;
    }

    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      audioEngine.resume();
      setIsPlaying(true);
    }
  }, [currentTrack, tracks, isPlaying, handleSelectTrack]);

  // Register AudioEngine callbacks + Headset disconnect + Service Worker Media Actions
  useEffect(() => {
    audioEngine.setCallbacks({
      onEnded: handleTrackEnded,
      onPrev: handlePrevTrack,
      onNext: handleNextTrack,
      onPlayState: (playing) => setIsPlaying(playing),
      onHeadsetDisconnect: () => {
        if (playerSettings.headsetAutoPause && audioEngine.isPlaying()) {
          audioEngine.pause();
          setIsPlaying(false);
          showToast('Audio output disconnected — playback paused.');
        }
      },
    });
  }, [handleTrackEnded, handlePrevTrack, handleNextTrack, playerSettings.headsetAutoPause, showToast]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PRIME_ONE_MEDIA_ACTION') {
        const action = event.data.action;
        if (action === 'play_pause') handleTogglePlay();
        else if (action === 'next') handleNextTrack();
        else if (action === 'prev') handlePrevTrack();
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [handleTogglePlay, handleNextTrack, handlePrevTrack]);

  // Preference Updaters (Local + Firestore Sync)
  const pushPrefsToCloud = useCallback(
    (nextEq: EqualizerSettings, nextLand: LandscapeThemeConfig, nextPlayer: PrimeOneSettings) => {
      if (user) {
        syncPreferencesToCloud(user.uid, nextEq, nextLand, nextPlayer).catch(() => {});
      }
    },
    [user]
  );

  const handleUpdateEQ = (newSettings: EqualizerSettings) => {
    setEqSettings(newSettings);
    saveSettingsToDB('eqSettings', newSettings);
    pushPrefsToCloud(newSettings, landscapeConfig, playerSettings);
  };

  const handleUpdateLandscape = (newConfig: LandscapeThemeConfig) => {
    setLandscapeConfig(newConfig);
    saveSettingsToDB('landscapeThemeConfig', newConfig);
    pushPrefsToCloud(eqSettings, newConfig, playerSettings);
  };

  const handleSaveCustomTheme = async (theme: CustomThemeRecord) => {
    await saveCustomThemeToDB(theme);
    setCustomThemes((prev) => [theme, ...prev.filter((t) => t.id !== theme.id)]);
    showToast(`Added "${theme.name}" (>4K) to Themes Collection!`);
  };

  const handleDeleteCustomTheme = async (themeId: string) => {
    await deleteCustomThemeFromDB(themeId);
    setCustomThemes((prev) => prev.filter((t) => t.id !== themeId));
    if (landscapeConfig.activeThemeId === themeId) {
      handleUpdateLandscape({
        ...landscapeConfig,
        activeThemeId: 'prime-one',
      });
    }
    showToast('Deleted custom AI theme.');
  };

  const handleUpdatePlayerSettings = (nextSettings: PrimeOneSettings) => {
    setPlayerSettings(nextSettings);
    saveSettingsToDB('primeOneSettings', nextSettings);
    audioEngine.setPlaybackRate(nextSettings.defaultPlaybackRate || 1.0);
    pushPrefsToCloud(eqSettings, landscapeConfig, nextSettings);
  };

  // Track Actions
  const handleToggleFavorite = (trackId: string) => {
    triggerHaptic(20);
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return;
    const nextFav = !target.isFavorite;
    const ov: TrackOverrideRecord = {
      ...overrides[trackId],
      id: trackId,
      isFavorite: nextFav,
    };
    setOverrides((prev) => ({ ...prev, [trackId]: ov }));
    saveTrackOverrideToDB(ov);

    if (user) {
      syncTrackToCloud(user.uid, { ...target, isFavorite: nextFav }).catch(() => {});
    }
  };

  const handleSaveEditedTags = async (updatedTrack: Track, applyCoverToAlbum: boolean) => {
    const newOv: TrackOverrideRecord = {
      ...overrides[updatedTrack.id],
      id: updatedTrack.id,
      title: updatedTrack.title,
      artist: updatedTrack.artist,
      album: updatedTrack.album,
      year: updatedTrack.year,
      trackNumber: updatedTrack.trackNumber,
      folderPath: updatedTrack.folderPath,
      genre: updatedTrack.genre,
      lyrics: updatedTrack.lyrics,
      coverUrl: updatedTrack.coverUrl,
    };

    const nextOverrides: Record<string, TrackOverrideRecord> = {
      ...overrides,
      [updatedTrack.id]: newOv,
    };

    await saveTrackOverrideToDB(newOv);
    if (updatedTrack.isLocal) {
      await saveLocalTrackToDB(updatedTrack);
      setLocalTracks((prev) => prev.map((t) => (t.id === updatedTrack.id ? updatedTrack : t)));
    }
    if (user) {
      syncTrackToCloud(user.uid, updatedTrack).catch(() => {});
    }

    if (applyCoverToAlbum && updatedTrack.coverUrl && updatedTrack.album) {
      for (const tr of tracks) {
        if (tr.album === updatedTrack.album && tr.id !== updatedTrack.id) {
          const siblingOv: TrackOverrideRecord = {
            ...nextOverrides[tr.id],
            id: tr.id,
            coverUrl: updatedTrack.coverUrl,
          };
          nextOverrides[tr.id] = siblingOv;
          saveTrackOverrideToDB(siblingOv);
          if (tr.isLocal) {
            saveLocalTrackToDB({ ...tr, coverUrl: updatedTrack.coverUrl });
          }
          if (user) {
            syncTrackToCloud(user.uid, { ...tr, coverUrl: updatedTrack.coverUrl }).catch(() => {});
          }
        }
      }
    }

    setOverrides(nextOverrides);
    showToast(`Saved ID3 tags & artwork for "${updatedTrack.title}"!`);
  };

  const handleTracksImported = (newTracks: Track[]) => {
    setLocalTracks((prev) => [...newTracks, ...prev]);
    setQueueIds((prev) => [...newTracks.map((t) => t.id), ...prev]);
    if (user) {
      newTracks.forEach((tr) => syncTrackToCloud(user.uid, tr).catch(() => {}));
    }
    if (newTracks.length > 0) {
      handleSelectTrack(newTracks[0]);
      showToast(`Imported ${newTracks.length} track(s) into Prime One!`);
    }
  };

  const handleTrackAddedOrUpdated = (track: Track) => {
    setLocalTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      return exists ? prev.map((t) => (t.id === track.id ? track : t)) : [track, ...prev];
    });
    if (user) {
      syncTrackToCloud(user.uid, track).catch(() => {});
    }
  };

  const handleDeleteLocalTrack = async (trackId: string) => {
    triggerHaptic(20);
    await deleteLocalTrackFromDB(trackId);
    setLocalTracks((prev) => prev.filter((t) => t.id !== trackId));
    setQueueIds((prev) => prev.filter((id) => id !== trackId));
    if (user) {
      deleteCloudTrack(user.uid, trackId).catch(() => {});
    }
    if (currentTrack?.id === trackId) {
      audioEngine.pause();
      setIsPlaying(false);
      setCurrentTrack(null);
    }
    showToast('Removed track from device storage.');
  };

  // Playlist Actions
  const handleCreatePlaylist = (name: string) => {
    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      trackIds: [],
      createdAt: Date.now(),
    };
    const updated = [...playlists, newPl];
    setPlaylists(updated);
    savePlaylistsToDB(updated);
    if (user) syncPlaylistToCloud(user.uid, newPl).catch(() => {});
  };

  const handleDeletePlaylist = (id: string) => {
    const updated = playlists.filter((p) => p.id !== id);
    setPlaylists(updated);
    savePlaylistsToDB(updated);
    if (user) deleteCloudPlaylist(user.uid, id).catch(() => {});
  };

  const handleAddTrackToPlaylist = (playlistId: string, trackId: string) => {
    let targetPl: Playlist | null = null;
    const updated = playlists.map((p) => {
      if (p.id === playlistId && !p.trackIds.includes(trackId)) {
        targetPl = { ...p, trackIds: [...p.trackIds, trackId] };
        return targetPl;
      }
      return p;
    });
    setPlaylists(updated);
    savePlaylistsToDB(updated);
    if (user && targetPl) syncPlaylistToCloud(user.uid, targetPl).catch(() => {});
    showToast('Added track to playlist.');
  };

  const handleRemoveTrackFromPlaylist = (playlistId: string, trackId: string) => {
    let targetPl: Playlist | null = null;
    const updated = playlists.map((p) => {
      if (p.id === playlistId) {
        targetPl = { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) };
        return targetPl;
      }
      return p;
    });
    setPlaylists(updated);
    savePlaylistsToDB(updated);
    if (user && targetPl) syncPlaylistToCloud(user.uid, targetPl).catch(() => {});
  };

  // Queue Helpers
  const handlePlayCollection = (collectionTracks: Track[], shuffleFirst = false) => {
    if (collectionTracks.length === 0) return;
    const ordered = shuffleFirst
      ? [...collectionTracks].sort(() => Math.random() - 0.5)
      : collectionTracks;
    setQueueIds(ordered.map((t) => t.id));
    if (shuffleFirst) setIsShuffle(true);
    handleSelectTrack(ordered[0]);
  };

  const handleAddToQueue = (track: Track) => {
    triggerHaptic(10);
    setQueueIds((prev) => (prev.includes(track.id) ? prev : [...prev, track.id]));
    showToast(`Added "${track.title}" to queue.`);
  };

  // Restore backup helper (from Google Drive or Local JSON)
  const handleRestoreBackup = (raw: PrimeOneCloudBackup | unknown) => {
    const data = raw as Partial<PrimeOneCloudBackup>;
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.playlists)) {
      setPlaylists(data.playlists);
      savePlaylistsToDB(data.playlists);
    }
    if (data.eqSettings) handleUpdateEQ(data.eqSettings);
    if (data.landscapeConfig) handleUpdateLandscape(data.landscapeConfig);
    if (data.playerSettings) handleUpdatePlayerSettings(data.playerSettings);
    if (Array.isArray(data.tracks)) {
      const nextOv: Record<string, TrackOverrideRecord> = { ...overrides };
      data.tracks.forEach((tr) => {
        if (!tr.id) return;
        const rec: TrackOverrideRecord = {
          id: tr.id,
          title: tr.title,
          artist: tr.artist,
          album: tr.album,
          year: tr.year,
          trackNumber: tr.trackNumber,
          folderPath: tr.folderPath,
          genre: tr.genre,
          lyrics: tr.lyrics,
          coverUrl: tr.coverUrl,
          isFavorite: tr.isFavorite,
          playCount: tr.playCount,
          lastPlayedAt: tr.lastPlayedAt,
          driveFileId: tr.driveFileId,
        };
        nextOv[tr.id] = rec;
        saveTrackOverrideToDB(rec);
      });
      setOverrides(nextOv);
    }
    showToast('Backup restored onto Prime One!');
  };

  const handleCloseAppSession = () => {
    triggerHaptic(20);
    audioEngine.pause();
    audioEngine.stopSynth();
    setIsPlaying(false);
    clearMediaNotification();
    setOverflowMenuOpen(false);
    setIsFullPlayerOpen(false);
    setIsLockScreenOpen(false);
    showToast('Prime One playback paused & background session cleared.');
  };

  // Unique Genres & Filtered Songs View
  const genres = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => {
      if (t.genre) set.add(t.genre);
    });
    return ['All', ...Array.from(set)];
  }, [tracks]);

  const displayedSongs = useMemo(() => {
    let list = [...tracks];
    if (selectedGenre !== 'All') {
      list = list.filter((t) => t.genre === selectedGenre);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.album.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      switch (sortOption) {
        case 'name-desc':
          return b.title.localeCompare(a.title);
        case 'artist-asc':
          return a.artist.localeCompare(b.artist);
        case 'artist-desc':
          return b.artist.localeCompare(a.artist);
        case 'duration-asc':
          return a.duration - b.duration;
        case 'duration-desc':
          return b.duration - a.duration;
        case 'year-asc':
          return (a.year || '0').localeCompare(b.year || '0');
        case 'year-desc':
          return (b.year || '0').localeCompare(a.year || '0');
        case 'updated-asc':
          return a.dateAdded - b.dateAdded;
        case 'updated-desc':
          return b.dateAdded - a.dateAdded;
        case 'songs-desc':
          return (b.playCount || 0) - (a.playCount || 0);
        case 'name-asc':
        default:
          return a.title.localeCompare(b.title);
      }
    });
    return list;
  }, [tracks, selectedGenre, searchQuery, sortOption]);

  const sortModalTitle =
    activeTab === 'albums'
      ? 'Sort albums by...'
      : activeTab === 'folders'
      ? 'Sort folders by...'
      : activeTab === 'artists'
      ? 'Sort artists by...'
      : 'Sort songs by...';

  const resolvedDiy = useMemo(
    () => ({ ...DEFAULT_DIY_STYLE, ...(landscapeConfig.diyStyle || {}) }),
    [landscapeConfig.diyStyle]
  );

  const activeThemeMeta = useMemo(() => {
    const all = [...customThemes, ...LANDSCAPE_THEMES];
    return all.find((t) => t.id === landscapeConfig.activeThemeId) || LANDSCAPE_THEMES[0];
  }, [customThemes, landscapeConfig.activeThemeId]);

  const effectiveAccentHex = resolvedDiy.customPrimaryHex || activeThemeMeta.accentHex || '#38bdf8';
  const effectiveSecondaryHex = resolvedDiy.customSecondaryHex || '#8b5cf6';
  const effectiveSurfaceHex =
    resolvedDiy.customSurfaceHex ||
    (resolvedDiy.screenStyle === 'amoled-black' ? '#000000' : '#0b111e');

  const rootStyle = {
    '--prime-accent': effectiveAccentHex,
    '--prime-accent-2': effectiveSecondaryHex,
    '--prime-surface': effectiveSurfaceHex,
    '--prime-glow': String(resolvedDiy.glowIntensity ?? 0.35),
  } as React.CSSProperties;

  return (
    <div
      style={rootStyle}
      data-screen-style={resolvedDiy.screenStyle}
      data-icon-pack={resolvedDiy.iconPack}
      data-icon-shape={resolvedDiy.iconShape}
      data-card-radius={resolvedDiy.cardRadius}
      className="prime-root relative min-h-screen text-slate-100 flex flex-col font-sans select-none antialiased bg-transparent"
    >
      {/* Full-Screen Thematic Landscape Wallpaper + Atmospheric Overlay */}
      <WallpaperBackground
        config={landscapeConfig}
        customThemes={customThemes}
        currentTrackCover={currentTrack?.coverUrl}
      />

      {/* Compact Sticky Top Chrome + Musicolet 9-Icon Bar */}
      <header className="prime-header sticky top-0 z-30 bg-[#0b0d14]/80 backdrop-blur-2xl border-b border-white/10 pt-safe shadow-lg shadow-black/30">
        {/* Top Brand & Quick Tools Row */}
        <div className="max-w-4xl mx-auto px-3.5 pt-2 pb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="prime-icon-btn w-8 h-8 rounded-xl overflow-hidden shadow-lg flex-shrink-0 border"
              style={{
                borderColor: `${effectiveAccentHex}90`,
              }}
            >
              <img
                src="/pwa-192x192.png"
                alt="Prime One"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-white truncate">
                Prime One
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                Android Hi-Fi &amp; Cloud Player
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* ◐ Thematic Landscapes + AI >4K + DIY Trigger */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                setIsLandscapeModalOpen(true);
              }}
              style={{ color: effectiveAccentHex, borderColor: `${effectiveAccentHex}55` }}
              className="prime-icon-btn px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border active:scale-95 transition flex items-center gap-1 font-bold min-h-[36px]"
              title="Themes, AI >4K & DIY Studio (◐)"
              aria-label="Themes and Wallpapers"
            >
              <span className="text-sm leading-none">◐</span>
              <span className="text-[11px] hidden sm:inline">Themes &amp; DIY</span>
            </button>

            {/* Song Original Art Background Toggle */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                handleUpdateLandscape({
                  ...landscapeConfig,
                  useAlbumArtFallback: !landscapeConfig.useAlbumArtFallback,
                });
              }}
              className={`px-2 py-1.5 rounded-xl border transition flex items-center gap-1 font-bold active:scale-95 min-h-[36px] ${
                landscapeConfig.useAlbumArtFallback
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Toggle Song Original Art Wallpaper"
              aria-label="Toggle Song Art Background"
            >
              <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] hidden sm:inline whitespace-nowrap">Song Art</span>
            </button>

            {/* Voice & Chat Companion Trigger */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                setIsGeminiStudioOpen(true);
              }}
              className="px-2 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/35 text-violet-200 active:scale-95 transition flex items-center gap-1 font-bold min-h-[36px]"
              title="Live Voice & Music Chat Companion"
              aria-label="Open Voice and Chat Companion"
            >
              <AudioLines className="w-3.5 h-3.5 text-violet-300" />
              <span className="text-[11px] hidden sm:inline whitespace-nowrap">Voice AI</span>
            </button>

            {/* Google Account & Cloud Drive Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic(15);
                setIsCloudModalOpen(true);
              }}
              className={`px-2 py-1.5 rounded-xl border transition flex items-center gap-1.5 min-h-[36px] ${
                user && accessToken
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : user
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                  : 'bg-white/5 border-white/15 text-slate-300 hover:text-white'
              }`}
              title={
                user
                  ? needsWorkspaceReauth
                    ? 'Reconnect Google Drive & Photos'
                    : `Connected: ${user.email}`
                  : 'Sign in with Google Cloud'
              }
              aria-label="Google Cloud Account"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Account"
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 rounded-full object-cover"
                />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              <span className="text-[11px] font-semibold hidden md:inline">
                {user ? (accessToken ? 'Cloud Sync' : 'Reconnect') : 'Google Cloud'}
              </span>
            </button>

            <PWAInstallButton />
          </div>
        </div>

        {/* Exact Musicolet 9-Icon Top Navigation Row */}
        <nav
          aria-label="Main Player Sections"
          className="max-w-4xl mx-auto px-1 flex items-center justify-between border-t border-white/5 relative"
        >
          {(
            [
              { id: 'queue', icon: ListStart, label: 'Queue' },
              { id: 'now-playing', icon: PlayCircle, label: 'Now Playing' },
              { id: 'library', icon: Library, label: 'Playlists & Library' },
              { id: 'folders', icon: Folder, label: 'Folders' },
              { id: 'artists', icon: UserIcon, label: 'Artists' },
              { id: 'tags', icon: Tag, label: 'Tags' },
              { id: 'albums', icon: Disc, label: 'Albums' },
              { id: 'songs', icon: Search, label: 'Search & All Songs' },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setOverflowMenuOpen(false);
                  if (item.id === 'now-playing') {
                    setIsFullPlayerOpen(true);
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`prime-icon-btn relative flex-1 py-2.5 flex items-center justify-center transition min-h-[44px] ${
                  isSelected ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={isSelected ? { color: effectiveAccentHex } : undefined}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className="w-5 h-5" />
                {isSelected && (
                  <span
                    className="absolute bottom-0 left-1.5 right-1.5 h-[2.5px] rounded-t-full"
                    style={{ backgroundColor: effectiveAccentHex }}
                  />
                )}
              </button>
            );
          })}

          {/* 9th Icon: Overflow ⋮ Menu */}
          <div className="relative flex-1 flex justify-center">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setOverflowMenuOpen((p) => !p);
              }}
              className="w-full py-2.5 flex items-center justify-center text-slate-300 hover:text-white transition min-h-[44px]"
              title="More options"
              aria-label="Overflow menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Musicolet Screenshot 4 Exact Dropdown Menu */}
            {overflowMenuOpen && (
              <div className="absolute right-2 top-11 z-50 w-52 rounded-xl bg-[#22232c] border border-white/15 shadow-2xl py-1.5 text-sm text-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setOverflowMenuOpen(false);
                    setIsEQOpen(true);
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <Sliders className="w-4 h-4 text-slate-300" />
                  <span>Equalizer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOverflowMenuOpen(false);
                    setIsSleepTimerOpen(true);
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <Moon className="w-4 h-4 text-slate-300" />
                  <span>Sleep timer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOverflowMenuOpen(false);
                    setIsGeminiStudioOpen(true);
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <AudioLines className="w-4 h-4 text-violet-300" />
                  <span>Voice &amp; Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOverflowMenuOpen(false);
                    setIsImporterOpen(true);
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <RefreshCw className="w-4 h-4 text-slate-300" />
                  <span>Scan</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOverflowMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <Settings className="w-4 h-4 text-slate-300" />
                  <span>Settings</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setOverflowMenuOpen(false);
                    triggerHaptic(15);
                    showToast('Packaging Prime-One-GitHub-App.zip...');
                    try {
                      await downloadGitHubAppZip();
                      showToast('Downloaded Prime-One-GitHub-App.zip!');
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : 'Failed to export GitHub ZIP.',
                        'error'
                      );
                    }
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <FolderArchive className="w-4 h-4 text-cyan-300" />
                  <span>Export GitHub ZIP</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setOverflowMenuOpen(false);
                    triggerHaptic(15);
                    showToast('Bundling single-file Prime-One-Player.html...');
                    try {
                      await downloadStandaloneHtml();
                      showToast('Downloaded Prime-One-Player.html!');
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : 'Failed to export HTML bundle.',
                        'error'
                      );
                    }
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <FileText className="w-4 h-4 text-emerald-300" />
                  <span>Export HTML File</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setOverflowMenuOpen(false);
                    triggerHaptic(15);
                    try {
                      await downloadWorkflowYaml();
                      showToast('Downloaded build-android-apk.yml workflow!');
                    } catch (err) {
                      showToast(
                        err instanceof Error ? err.message : 'Failed to download workflow YAML.',
                        'error'
                      );
                    }
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <FileCode2 className="w-4 h-4 text-violet-300" />
                  <span>APK Workflow (.yml)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOverflowMenuOpen(false);
                    setIsHelpOpen(true);
                  }}
                  className="w-full px-4 py-3 hover:bg-white/10 flex items-center gap-4 text-left"
                >
                  <HelpCircle className="w-4 h-4 text-slate-300" />
                  <span>Help and info</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseAppSession}
                  className="w-full px-4 py-3 hover:bg-red-500/15 text-slate-100 flex items-center gap-4 text-left border-t border-white/10 mt-1 pt-3"
                >
                  <Power className="w-4 h-4 text-slate-300" />
                  <span>Close app</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Non-blocking Toast Banner */}
      {toast && (
        <div className="max-w-4xl mx-auto w-full px-4 pt-2 z-20">
          <div
            className={`px-3.5 py-2 rounded-xl border text-xs font-medium flex items-center gap-2 backdrop-blur-xl ${
              toast.kind === 'error'
                ? 'bg-red-500/20 border-red-400/40 text-red-200'
                : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200'
            }`}
          >
            {toast.kind === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="truncate">{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main
        className="flex-1 max-w-4xl mx-auto w-full px-3.5 sm:px-5 pt-3 pb-28"
        onClick={() => overflowMenuOpen && setOverflowMenuOpen(false)}
      >
        {activeTab === 'queue' && (
          <QueueView
            queue={queueTracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onSelectTrack={handleSelectTrack}
            onRemoveFromQueue={(id) =>
              setQueueIds((prev) => prev.filter((item) => item !== id))
            }
            onMoveToTop={(idx) => {
              setQueueIds((prev) => {
                const copy = [...prev];
                const [picked] = copy.splice(idx, 1);
                copy.unshift(picked);
                return copy;
              });
            }}
            onShuffleQueue={() => {
              setIsShuffle(true);
              setQueueIds((prev) => [...prev].sort(() => Math.random() - 0.5));
              showToast('Playing queue shuffled.');
            }}
            onClearQueue={() => setQueueIds([])}
            onOpenAmbient={() => setIsAmbientOpen(true)}
          />
        )}

        {activeTab === 'library' && (
          <PlaylistsLibraryView
            tracks={tracks}
            playlists={playlists}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            showWaveforms={playerSettings.showWaveforms}
            canUploadToDrive={Boolean(accessToken)}
            onSelectTrack={handleSelectTrack}
            onPlayList={(list) => handlePlayCollection(list, false)}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onToggleFavorite={handleToggleFavorite}
            onEditTags={setEditingTagTrack}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddTrackToPlaylist}
            onUploadToDrive={() => setIsCloudModalOpen(true)}
            onDeleteLocal={handleDeleteLocalTrack}
          />
        )}

        {activeTab === 'folders' && (
          <FoldersView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            showWaveforms={playerSettings.showWaveforms}
            playlists={playlists}
            canUploadToDrive={Boolean(accessToken)}
            sortOption={sortOption}
            onOpenSort={() => setIsSortModalOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenImporter={() => setIsImporterOpen(true)}
            onSelectTrack={handleSelectTrack}
            onPlayFolder={(list) => handlePlayCollection(list, false)}
            onToggleFavorite={handleToggleFavorite}
            onEditTags={setEditingTagTrack}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddTrackToPlaylist}
            onUploadToDrive={() => setIsCloudModalOpen(true)}
            onDeleteLocal={handleDeleteLocalTrack}
          />
        )}

        {activeTab === 'artists' && (
          <ArtistsView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            showWaveforms={playerSettings.showWaveforms}
            sortOption={sortOption}
            playlists={playlists}
            canUploadToDrive={Boolean(accessToken)}
            onOpenSort={() => setIsSortModalOpen(true)}
            onSelectTrack={handleSelectTrack}
            onPlayArtist={(list) => handlePlayCollection(list, false)}
            onToggleFavorite={handleToggleFavorite}
            onEditTags={setEditingTagTrack}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddTrackToPlaylist}
            onUploadToDrive={() => setIsCloudModalOpen(true)}
            onDeleteLocal={handleDeleteLocalTrack}
          />
        )}

        {activeTab === 'tags' && (
          <TagsManagerView
            tracks={tracks}
            onEditTags={setEditingTagTrack}
            hasGooglePhotosAccess={Boolean(accessToken)}
            onOpenCloudModal={() => setIsCloudModalOpen(true)}
          />
        )}

        {activeTab === 'albums' && (
          <AlbumsGridView
            tracks={tracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            showWaveforms={playerSettings.showWaveforms}
            compactGrid={playerSettings.compactAlbumGrid}
            sortOption={sortOption}
            playlists={playlists}
            canUploadToDrive={Boolean(accessToken)}
            onOpenSort={() => setIsSortModalOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSelectTrack={handleSelectTrack}
            onPlayAlbum={(list, shuf) => handlePlayCollection(list, shuf)}
            onToggleFavorite={handleToggleFavorite}
            onEditTags={setEditingTagTrack}
            onAddToQueue={handleAddToQueue}
            onAddToPlaylist={handleAddTrackToPlaylist}
            onUploadToDrive={() => setIsCloudModalOpen(true)}
            onDeleteLocal={handleDeleteLocalTrack}
          />
        )}

        {activeTab === 'songs' && (
          <div className="space-y-3">
            {/* Search + Sort + Import Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 flex items-center">
                <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search tracks, artists, or albums..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/45 backdrop-blur-xl border border-white/15 rounded-2xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsSortModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-black/45 border border-white/15 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1"
                title="Sort songs"
              >
                <span>Sort</span>
              </button>

              <button
                type="button"
                onClick={() => setIsImporterOpen(true)}
                className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/30"
                title="Scan / Import Device Music"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>

            {/* Genre Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {genres.map((g) => {
                const isSel = selectedGenre === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setSelectedGenre(g);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap transition backdrop-blur-md ${
                      isSel
                        ? 'bg-cyan-500 text-black font-bold border border-cyan-400'
                        : 'bg-black/35 text-slate-300 border border-white/10 hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsAmbientOpen(true)}
                className="px-3 py-1 rounded-xl text-xs font-medium whitespace-nowrap bg-amber-500/15 text-amber-300 border border-amber-400/30 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Ambient</span>
              </button>
            </div>

            {/* Track List with Static Waveforms */}
            {displayedSongs.length > 0 ? (
              <div className="space-y-2.5">
                {displayedSongs.map((track) => (
                  <TrackListItem
                    key={track.id}
                    track={track}
                    isCurrent={currentTrack?.id === track.id}
                    isPlaying={isPlaying}
                    playbackProgress={playbackProgress}
                    showWaveforms={playerSettings.showWaveforms}
                    playlists={playlists}
                    canUploadToDrive={Boolean(accessToken)}
                    diyStyle={resolvedDiy}
                    onSelect={(tr) => {
                      setQueueIds(displayedSongs.map((x) => x.id));
                      handleSelectTrack(tr);
                    }}
                    onToggleFavorite={handleToggleFavorite}
                    onEditTags={setEditingTagTrack}
                    onAddToQueue={handleAddToQueue}
                    onAddToPlaylist={handleAddTrackToPlaylist}
                    onUploadToDrive={() => setIsCloudModalOpen(true)}
                    onDeleteLocal={handleDeleteLocalTrack}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 px-4 rounded-3xl bg-white/5 border border-white/10">
                <Music className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">No songs match your filter</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Scan a local Android music folder or connect Google Drive in Cloud Settings.
                </p>
                <button
                  type="button"
                  onClick={() => setIsImporterOpen(true)}
                  className="mt-4 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-xs font-bold text-white inline-flex items-center gap-2"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Scan Device Audio</span>
                </button>
              </div>
            )}

            <FastScroller items={displayedSongs} getLabel={(t) => t.title} />
          </div>
        )}
      </main>

      {/* Unified Gesture-Driven Mini Player <-> Bottom Sheet <-> Full-Screen Player */}
      <ExpandablePlayerSheet
        isOpen={isFullPlayerOpen}
        onOpenChange={setIsFullPlayerOpen}
        track={currentTrack}
        isPlaying={isPlaying}
        playbackMode={playbackMode}
        isShuffle={isShuffle}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrevTrack}
        onNext={handleNextTrack}
        onToggleRepeat={() => {
          triggerHaptic(15);
          setPlaybackMode((p) =>
            p === 'off' ? 'repeat-all' : p === 'repeat-all' ? 'repeat-one' : 'off'
          );
        }}
        onToggleShuffle={() => {
          triggerHaptic(15);
          setIsShuffle((p) => !p);
        }}
        onToggleFavorite={handleToggleFavorite}
        onOpenEQ={() => setIsEQOpen(true)}
        onOpenSleepTimer={() => setIsSleepTimerOpen(true)}
        onOpenWallpaper={() => setIsLandscapeModalOpen(true)}
        onEditTags={(t) => setEditingTagTrack(t)}
        useAlbumArtBackground={landscapeConfig.useAlbumArtFallback}
        onToggleSongArtBackground={() =>
          handleUpdateLandscape({
            ...landscapeConfig,
            useAlbumArtFallback: !landscapeConfig.useAlbumArtFallback,
          })
        }
        diyStyle={resolvedDiy}
        accentHex={effectiveAccentHex}
      />

      <GeminiStudioModal
        isOpen={isGeminiStudioOpen}
        onClose={() => setIsGeminiStudioOpen(false)}
        currentTrack={currentTrack}
      />

      <ThemeLandscapeModal
        isOpen={isLandscapeModalOpen}
        onClose={() => setIsLandscapeModalOpen(false)}
        config={landscapeConfig}
        onUpdateConfig={handleUpdateLandscape}
        customThemes={customThemes}
        onSaveCustomTheme={handleSaveCustomTheme}
        onDeleteCustomTheme={handleDeleteCustomTheme}
        currentTrackCover={currentTrack?.coverUrl}
      />

      <EqualizerModal
        isOpen={isEQOpen}
        onClose={() => setIsEQOpen(false)}
        settings={eqSettings}
        onUpdateSettings={handleUpdateEQ}
      />

      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
        sleepTimer={sleepTimer}
        onSetTimer={setSleepTimer}
      />

      <FileImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onTracksImported={handleTracksImported}
        existingCount={localTracks.length}
        autoExtractArt={playerSettings.autoExtractArt}
      />

      <AmbientGeneratorModal
        isOpen={isAmbientOpen}
        onClose={() => setIsAmbientOpen(false)}
        onActiveStateChange={() => {
          setIsPlaying(audioEngine.isPlaying());
          if (audioEngine.currentTrack) {
            setCurrentTrack(audioEngine.currentTrack);
          }
        }}
      />

      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        playlists={playlists}
        allTracks={tracks}
        onPlayTrack={handleSelectTrack}
        onCreatePlaylist={handleCreatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onAddTrackToPlaylist={handleAddTrackToPlaylist}
        onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
      />

      <SortModal
        isOpen={isSortModalOpen}
        title={sortModalTitle}
        currentSort={sortOption}
        onSelect={setSortOption}
        onClose={() => setIsSortModalOpen(false)}
      />

      <TagEditorModal
        track={editingTagTrack}
        isOpen={Boolean(editingTagTrack)}
        onClose={() => setEditingTagTrack(null)}
        onSaveTags={handleSaveEditedTags}
        user={user}
        accessToken={accessToken}
        onGoogleSignedIn={(u, tok) => {
          setUser(u);
          setAccessToken(tok);
          setNeedsWorkspaceReauth(false);
        }}
      />

      <CloudDriveModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        user={user}
        accessToken={accessToken}
        needsWorkspaceReauth={needsWorkspaceReauth}
        onGoogleSignedIn={(u, tok) => {
          setUser(u);
          setAccessToken(tok);
          setNeedsWorkspaceReauth(false);
        }}
        onGoogleSignedOut={() => {
          setUser(null);
          setAccessToken(null);
          setNeedsWorkspaceReauth(false);
        }}
        tracks={tracks}
        playlists={playlists}
        eqSettings={eqSettings}
        landscapeConfig={landscapeConfig}
        playerSettings={playerSettings}
        onTrackAddedOrUpdated={handleTrackAddedOrUpdated}
        onPlayTrack={handleSelectTrack}
        onRestoreBackupData={handleRestoreBackup}
        onRequestConfirm={setConfirmConfig}
        setConfirmBusy={setConfirmBusy}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={playerSettings}
        onUpdateSettings={handleUpdatePlayerSettings}
        landscapeConfig={landscapeConfig}
        onUpdateLandscape={handleUpdateLandscape}
        onOpenThemesModal={() => setIsLandscapeModalOpen(true)}
        onOpenEQModal={() => setIsEQOpen(true)}
        onOpenImporterModal={() => setIsImporterOpen(true)}
        onOpenCloudDriveModal={() => setIsCloudModalOpen(true)}
        onOpenLockScreen={() => setIsLockScreenOpen(true)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        user={user}
        accessToken={accessToken}
        needsWorkspaceReauth={needsWorkspaceReauth}
        onGoogleSignedIn={(u, tok) => {
          setUser(u);
          setAccessToken(tok);
          setNeedsWorkspaceReauth(false);
        }}
        onGoogleSignedOut={() => {
          setUser(null);
          setAccessToken(null);
          setNeedsWorkspaceReauth(false);
        }}
        tracks={tracks}
        playlists={playlists}
        eqSettings={eqSettings}
        onImportJsonBackup={handleRestoreBackup}
        accentHex={effectiveAccentHex}
      />

      <HelpInfoModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <LockScreenOverlay
        isOpen={isLockScreenOpen}
        onUnlock={() => setIsLockScreenOpen(false)}
        track={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onPrev={handlePrevTrack}
        onNext={handleNextTrack}
      />

      <ConfirmActionModal
        config={confirmConfig}
        isBusy={confirmBusy}
        onCancel={() => setConfirmConfig(null)}
      />

      <OfflineIndicator />
    </div>
  );
}
