import React, { useState, useMemo, useRef } from 'react';
import {
  Folder,
  FolderHeart,
  Settings,
  MoreHorizontal,
  Clock,
  Search,
  ArrowLeft,
  Play,
  FolderPlus,
  SortAsc,
} from 'lucide-react';
import { Track, Playlist, SortOption } from '../types/music';
import { formatDurationHMS, triggerHaptic } from '../services/audioEngine';
import { TrackListItem } from './TrackListItem';
import { PredictiveBackContainer, PredictiveBackHandle } from './PredictiveBackContainer';
import { FastScroller } from './FastScroller';

interface FoldersViewProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackProgress: number;
  showWaveforms: boolean;
  playlists: Playlist[];
  canUploadToDrive: boolean;
  sortOption: SortOption;
  onOpenSort: () => void;
  onOpenSettings: () => void;
  onOpenImporter: () => void;
  onSelectTrack: (track: Track) => void;
  onPlayFolder: (folderTracks: Track[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onEditTags: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onUploadToDrive?: (track: Track) => void;
  onDeleteLocal?: (trackId: string) => void;
}

interface FolderGroup {
  fullPath: string;
  label: string;
  tracks: Track[];
  totalDuration: number;
  latestUpdated: number;
}

export const FoldersView: React.FC<FoldersViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  playbackProgress,
  showWaveforms,
  playlists,
  canUploadToDrive,
  sortOption,
  onOpenSort,
  onOpenSettings,
  onOpenImporter,
  onSelectTrack,
  onPlayFolder,
  onToggleFavorite,
  onEditTags,
  onAddToQueue,
  onAddToPlaylist,
  onUploadToDrive,
  onDeleteLocal,
}) => {
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [listSearch, setListSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const backHandleRef = useRef<PredictiveBackHandle | null>(null);

  const folderGroups = useMemo<FolderGroup[]>(() => {
    const map = new Map<string, Track[]>();
    tracks.forEach((tr) => {
      const rawPath = (tr.folderPath || 'Internal Storage/Music').trim();
      const parts = rawPath.split('/').filter(Boolean);
      const normalized = parts.length > 0 ? parts.join('/') : 'Internal Storage/Music';
      const existing = map.get(normalized) || [];
      existing.push(tr);
      map.set(normalized, existing);
    });

    const groups: FolderGroup[] = Array.from(map.entries()).map(([fullPath, list]) => {
      const segments = fullPath.split('/');
      const label = segments[segments.length - 1] || fullPath;
      const totalDuration = list.reduce((acc, t) => acc + (t.duration || 0), 0);
      const latestUpdated = list.reduce((acc, t) => Math.max(acc, t.dateAdded || 0), 0);
      return {
        fullPath,
        label,
        tracks: list,
        totalDuration,
        latestUpdated,
      };
    });

    groups.sort((a, b) => {
      switch (sortOption) {
        case 'name-desc':
          return b.label.localeCompare(a.label);
        case 'songs-asc':
          return a.tracks.length - b.tracks.length;
        case 'songs-desc':
          return b.tracks.length - a.tracks.length;
        case 'duration-asc':
          return a.totalDuration - b.totalDuration;
        case 'duration-desc':
          return b.totalDuration - a.totalDuration;
        case 'updated-asc':
          return a.latestUpdated - b.latestUpdated;
        case 'updated-desc':
          return b.latestUpdated - a.latestUpdated;
        default:
          return a.label.localeCompare(b.label);
      }
    });

    return groups;
  }, [tracks, sortOption]);

  const totalDurationAll = useMemo(
    () => tracks.reduce((acc, t) => acc + (t.duration || 0), 0),
    [tracks]
  );

  const filteredFolders = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return folderGroups;
    return folderGroups.filter(
      (f) => f.label.toLowerCase().includes(q) || f.fullPath.toLowerCase().includes(q)
    );
  }, [folderGroups, listSearch]);

  const activeFolder = selectedFolderPath
    ? folderGroups.find((f) => f.fullPath === selectedFolderPath) || null
    : null;

  const filteredFolderTracks = useMemo(() => {
    if (!activeFolder) return [];
    const q = listSearch.trim().toLowerCase();
    if (!q) return activeFolder.tracks;
    return activeFolder.tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }, [activeFolder, listSearch]);

  const handleCloseFolder = () => {
    setSelectedFolderPath(null);
    setListSearch('');
  };

  const renderFolderHeader = (folder: FolderGroup | null) => (
    <div className="flex items-center justify-between px-1 pb-2">
      <div className="flex items-center gap-2.5 min-w-0">
        {folder ? (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              if (backHandleRef.current) {
                backHandleRef.current.triggerBack();
              } else {
                handleCloseFolder();
              }
            }}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Back to Internal Storage"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <FolderHeart className="w-5 h-5 text-slate-200 flex-shrink-0" />
        )}
        <h2 className="text-base font-bold text-white truncate">
          {folder ? folder.label : 'Internal Storage'}
        </h2>
      </div>

      <button
        type="button"
        onClick={() => {
          triggerHaptic(10);
          onOpenSettings();
        }}
        className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="Folder & Scanner Settings"
        aria-label="Folder Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
    </div>
  );

  const rootFoldersScreen = (
    <div className="flex flex-col min-h-[68vh] relative">
      {renderFolderHeader(null)}

      {/* Path Breadcrumb & Summary Row */}
      <div className="px-1 pb-3 border-b border-white/10 flex items-center justify-between gap-2 relative">
        <div>
          <div className="text-xs text-slate-400 truncate max-w-[260px] sm:max-w-md">
            Internal Storage
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-300 font-medium tabular-nums">
            <span>
              {folderGroups.length} subfolders, {tracks.length} songs
            </span>
            <span className="text-slate-600">|</span>
            <span className="inline-flex items-center gap-1 font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatDurationHMS(totalDurationAll)}
            </span>
          </div>
        </div>

        {/* Floating (...) Pill matching Screenshot 1 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setMenuOpen((p) => !p);
            }}
            className="w-9 h-7 rounded-lg bg-white text-black flex items-center justify-center shadow-lg hover:bg-slate-200 transition active:scale-95"
            title="Folder actions"
            aria-label="Folder actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && !activeFolder && (
            <div className="absolute right-0 top-9 z-40 w-52 rounded-2xl bg-[#181b25] border border-white/15 shadow-2xl p-1.5 text-xs text-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenImporter();
                }}
                className="w-full px-3 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-left"
              >
                <FolderPlus className="w-4 h-4 text-cyan-400" />
                <span>Scan Music Folder</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenSort();
                }}
                className="w-full px-3 py-2.5 rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-left"
              >
                <SortAsc className="w-4 h-4 text-violet-400" />
                <span>Sort folders by...</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Folder List */}
      <div className="flex-1 py-2 space-y-1.5">
        {filteredFolders.length > 0 ? (
          filteredFolders.map((folder) => (
            <button
              key={folder.fullPath}
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setSelectedFolderPath(folder.fullPath);
                setListSearch('');
              }}
              className="w-full px-3 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] flex items-center justify-between gap-3 transition text-left min-h-[54px]"
            >
              <div className="flex items-center gap-4 min-w-0">
                <Folder className="w-6 h-6 text-slate-200 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{folder.label}</div>
                  <div className="text-[10px] text-slate-500 truncate">{folder.fullPath}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex-shrink-0 tabular-nums">
                {folder.tracks.length} {folder.tracks.length === 1 ? 'song' : 'songs'}
              </div>
            </button>
          ))
        ) : (
          <div className="py-12 text-center text-xs text-slate-400">
            No folders match &ldquo;{listSearch}&rdquo;.
          </div>
        )}
      </div>

      {/* Bottom List Search Bar matching Screenshot 1 */}
      <div className="mt-3 pt-2 border-t border-white/10">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search in this list..."
            className="w-full bg-black/45 backdrop-blur-xl border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-400"
          />
          {listSearch && (
            <button
              type="button"
              onClick={() => setListSearch('')}
              className="absolute right-3 text-[11px] text-slate-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const detailFolderScreen = activeFolder ? (
    <div className="flex flex-col min-h-[68vh] relative">
      {renderFolderHeader(activeFolder)}

      <div className="px-1 pb-3 border-b border-white/10 flex items-center justify-between gap-2 relative">
        <div>
          <div className="text-xs text-slate-400 truncate max-w-[260px] sm:max-w-md">
            {activeFolder.fullPath}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-300 font-medium tabular-nums">
            <span>{activeFolder.tracks.length} songs</span>
            <span className="text-slate-600">|</span>
            <span className="inline-flex items-center gap-1 font-mono text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {formatDurationHMS(activeFolder.totalDuration)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(12);
            onPlayFolder(filteredFolderTracks);
          }}
          className="px-3.5 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play All</span>
        </button>
      </div>

      <div className="flex-1 py-2.5 space-y-2.5">
        {filteredFolderTracks.map((tr) => (
          <TrackListItem
            key={tr.id}
            track={tr}
            isCurrent={currentTrack?.id === tr.id}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            showWaveforms={showWaveforms}
            playlists={playlists}
            canUploadToDrive={canUploadToDrive}
            onSelect={onSelectTrack}
            onToggleFavorite={onToggleFavorite}
            onEditTags={onEditTags}
            onAddToQueue={onAddToQueue}
            onAddToPlaylist={onAddToPlaylist}
            onUploadToDrive={onUploadToDrive}
            onDeleteLocal={onDeleteLocal}
          />
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-white/10">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder={`Search in ${activeFolder.label}...`}
            className="w-full bg-black/45 backdrop-blur-xl border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-400"
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <PredictiveBackContainer
        ref={backHandleRef}
        canGoBack={Boolean(activeFolder)}
        onBack={handleCloseFolder}
        backgroundContent={rootFoldersScreen}
        foregroundContent={detailFolderScreen}
      />
      {activeFolder ? (
        <FastScroller items={filteredFolderTracks} getLabel={(t) => t.title} />
      ) : (
        <FastScroller items={filteredFolders} getLabel={(f) => f.label} />
      )}
    </>
  );
};
