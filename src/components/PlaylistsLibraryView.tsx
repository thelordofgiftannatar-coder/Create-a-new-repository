import React, { useState, useMemo, useRef } from 'react';
import {
  Library,
  Heart,
  Clock3,
  History,
  Flame,
  Ban,
  ListMusic,
  Plus,
  Search,
  ArrowLeft,
  Play,
  Trash2,
} from 'lucide-react';
import { Track, Playlist } from '../types/music';
import { triggerHaptic } from '../services/audioEngine';
import { TrackListItem } from './TrackListItem';
import { PredictiveBackContainer, PredictiveBackHandle } from './PredictiveBackContainer';
import { FastScroller } from './FastScroller';

interface PlaylistsLibraryViewProps {
  tracks: Track[];
  playlists: Playlist[];
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackProgress: number;
  showWaveforms: boolean;
  canUploadToDrive: boolean;
  onSelectTrack: (track: Track) => void;
  onPlayList: (tracks: Track[]) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onToggleFavorite: (trackId: string) => void;
  onEditTags: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onUploadToDrive?: (track: Track) => void;
  onDeleteLocal?: (trackId: string) => void;
}

type SmartBucket =
  | { kind: 'smart'; id: 'all' | 'favorites' | 'recent_added' | 'recent_played' | 'most_played' | 'not_played'; label: string }
  | { kind: 'playlist'; id: string; label: string };

export const PlaylistsLibraryView: React.FC<PlaylistsLibraryViewProps> = ({
  tracks,
  playlists,
  currentTrack,
  isPlaying,
  playbackProgress,
  showWaveforms,
  canUploadToDrive,
  onSelectTrack,
  onPlayList,
  onCreatePlaylist,
  onDeletePlaylist,
  onToggleFavorite,
  onEditTags,
  onAddToQueue,
  onAddToPlaylist,
  onUploadToDrive,
  onDeleteLocal,
}) => {
  const [activeBucket, setActiveBucket] = useState<SmartBucket | null>(null);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const backHandleRef = useRef<PredictiveBackHandle | null>(null);

  const smartLists = useMemo(() => {
    const favorites = tracks.filter((t) => t.isFavorite);
    const recentlyAdded = [...tracks].sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
    const recentlyPlayed = [...tracks]
      .filter((t) => Boolean(t.lastPlayedAt))
      .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
    const mostPlayed = [...tracks]
      .filter((t) => (t.playCount || 0) > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    const notPlayed = tracks.filter((t) => !t.playCount || t.playCount === 0);

    return {
      all: tracks,
      favorites,
      recent_added: recentlyAdded,
      recent_played: recentlyPlayed,
      most_played: mostPlayed,
      not_played: notPlayed,
    };
  }, [tracks]);

  const filteredPlaylists = useMemo(() => {
    const q = playlistSearch.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }, [playlists, playlistSearch]);

  const bucketTracks = useMemo(() => {
    if (!activeBucket) return [];
    let list: Track[] = [];
    if (activeBucket.kind === 'smart') {
      list = smartLists[activeBucket.id] || [];
    } else {
      const pl = playlists.find((p) => p.id === activeBucket.id);
      list = pl
        ? pl.trackIds
            .map((id) => tracks.find((t) => t.id === id))
            .filter((t): t is Track => Boolean(t))
        : [];
    }
    const q = playlistSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    );
  }, [activeBucket, smartLists, playlists, tracks, playlistSearch]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    triggerHaptic(20);
    onCreatePlaylist(newName.trim());
    setNewName('');
    setShowCreateForm(false);
  };

  const SMART_ROWS: {
    id: 'all' | 'favorites' | 'recent_added' | 'recent_played' | 'most_played' | 'not_played';
    label: string;
    count: number;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'all', label: 'All songs', count: smartLists.all.length, icon: Library },
    { id: 'favorites', label: 'Favorites', count: smartLists.favorites.length, icon: Heart },
    { id: 'recent_added', label: 'Recently added', count: smartLists.recent_added.length, icon: Clock3 },
    { id: 'recent_played', label: 'Recently played', count: smartLists.recent_played.length, icon: History },
    { id: 'most_played', label: 'Most played', count: smartLists.most_played.length, icon: Flame },
    { id: 'not_played', label: 'Not played', count: smartLists.not_played.length, icon: Ban },
  ];

  const handleCloseBucket = () => {
    setActiveBucket(null);
    setPlaylistSearch('');
  };

  const rootScreen = (
    <div className="flex flex-col min-h-[68vh]">
      <div className="space-y-0.5">
        {SMART_ROWS.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setActiveBucket({ kind: 'smart', id: row.id, label: row.label });
                setPlaylistSearch('');
              }}
              className="w-full px-3 py-3.5 rounded-2xl hover:bg-white/[0.07] active:bg-white/[0.12] flex items-center justify-between transition text-left min-h-[50px]"
            >
              <div className="flex items-center gap-5">
                <Icon className="w-5 h-5 text-slate-100 flex-shrink-0" />
                <span className="text-[15px] font-medium text-white">{row.label}</span>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">{row.count}</span>
            </button>
          );
        })}
      </div>

      <div className="my-2 border-t border-white/10" />

      <div className="px-3 pt-2 pb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold tracking-wide text-violet-400">Your playlists</span>
        <span className="text-[11px] font-mono text-slate-500 tabular-nums">{playlists.length}</span>
      </div>

      <div className="flex-1 space-y-0.5">
        {filteredPlaylists.map((pl) => (
          <button
            key={pl.id}
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setActiveBucket({ kind: 'playlist', id: pl.id, label: pl.name });
              setPlaylistSearch('');
            }}
            className="w-full px-3 py-3.5 rounded-2xl hover:bg-white/[0.07] active:bg-white/[0.12] flex items-center justify-between transition text-left min-h-[50px]"
          >
            <div className="flex items-center gap-5 min-w-0">
              <ListMusic className="w-5 h-5 text-slate-200 flex-shrink-0" />
              <span className="text-[15px] font-medium text-white truncate">{pl.name}</span>
            </div>
            <span className="text-xs font-mono text-slate-400 tabular-nums flex-shrink-0">
              {pl.trackIds.length}
            </span>
          </button>
        ))}

        {showCreateForm ? (
          <form
            onSubmit={handleCreateSubmit}
            className="mx-1 mt-2 p-3 rounded-2xl bg-white/[0.07] border border-violet-400/40 flex gap-2"
          >
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Playlist name..."
              className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-violet-500 text-white text-xs font-bold"
            >
              Create
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setShowCreateForm(true);
            }}
            className="mt-2 ml-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-sm font-medium text-slate-200 inline-flex items-center gap-2.5 min-h-[44px]"
          >
            <Plus className="w-4 h-4 text-violet-400" />
            <span>New playlist</span>
          </button>
        )}
      </div>

      <div className="mt-4 pt-2 border-t border-white/10">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={playlistSearch}
            onChange={(e) => setPlaylistSearch(e.target.value)}
            placeholder="Search a playlist..."
            className="w-full bg-black/45 backdrop-blur-xl border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-400"
          />
        </div>
      </div>
    </div>
  );

  const detailScreen = activeBucket ? (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              if (backHandleRef.current) {
                backHandleRef.current.triggerBack();
              } else {
                handleCloseBucket();
              }
            }}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Back to Playlists"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">{activeBucket.label}</h2>
            <div className="text-[11px] text-slate-400 tabular-nums">
              {bucketTracks.length} songs
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {bucketTracks.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayList(bucketTracks)}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play All</span>
            </button>
          )}
          {activeBucket.kind === 'playlist' && playlists.length > 1 && (
            <button
              type="button"
              onClick={() => {
                onDeletePlaylist(activeBucket.id);
                setActiveBucket(null);
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300"
              title="Delete playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={playlistSearch}
          onChange={(e) => setPlaylistSearch(e.target.value)}
          placeholder={`Search in ${activeBucket.label}...`}
          className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-400"
        />
      </div>

      <div className="space-y-2.5">
        {bucketTracks.length > 0 ? (
          bucketTracks.map((tr) => (
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
          ))
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 bg-white/[0.04] rounded-2xl border border-white/5">
            No tracks in this collection yet.
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <PredictiveBackContainer
        ref={backHandleRef}
        canGoBack={Boolean(activeBucket)}
        onBack={handleCloseBucket}
        backgroundContent={rootScreen}
        foregroundContent={detailScreen}
      />
      {activeBucket && (
        <FastScroller items={bucketTracks} getLabel={(t) => t.title} />
      )}
    </>
  );
};
