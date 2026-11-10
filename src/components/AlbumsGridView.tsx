import React, { useState, useMemo, useRef } from 'react';
import { Search, SortAsc, Settings, ArrowLeft, Play, Shuffle, Disc } from 'lucide-react';
import { Track, Playlist, SortOption } from '../types/music';
import { formatDurationHMS, triggerHaptic } from '../services/audioEngine';
import { TrackListItem } from './TrackListItem';
import { PredictiveBackContainer, PredictiveBackHandle } from './PredictiveBackContainer';
import { FastScroller } from './FastScroller';

interface AlbumsGridViewProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackProgress: number;
  showWaveforms: boolean;
  compactGrid: boolean;
  sortOption: SortOption;
  playlists: Playlist[];
  canUploadToDrive: boolean;
  onOpenSort: () => void;
  onOpenSettings: () => void;
  onSelectTrack: (track: Track) => void;
  onPlayAlbum: (albumTracks: Track[], shuffle?: boolean) => void;
  onToggleFavorite: (trackId: string) => void;
  onEditTags: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onUploadToDrive?: (track: Track) => void;
  onDeleteLocal?: (trackId: string) => void;
}

interface AlbumGroup {
  name: string;
  artist: string;
  coverUrl: string;
  year: string;
  tracks: Track[];
  totalDuration: number;
  latestUpdated: number;
}

export const AlbumsGridView: React.FC<AlbumsGridViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  playbackProgress,
  showWaveforms,
  compactGrid,
  sortOption,
  playlists,
  canUploadToDrive,
  onOpenSort,
  onOpenSettings,
  onSelectTrack,
  onPlayAlbum,
  onToggleFavorite,
  onEditTags,
  onAddToQueue,
  onAddToPlaylist,
  onUploadToDrive,
  onDeleteLocal,
}) => {
  const [albumQuery, setAlbumQuery] = useState('');
  const [selectedAlbumName, setSelectedAlbumName] = useState<string | null>(null);
  const backHandleRef = useRef<PredictiveBackHandle | null>(null);

  const albums = useMemo<AlbumGroup[]>(() => {
    const map = new Map<string, Track[]>();
    tracks.forEach((tr) => {
      const albumName = (tr.album || 'Prime One Library').trim();
      const arr = map.get(albumName) || [];
      arr.push(tr);
      map.set(albumName, arr);
    });

    const list: AlbumGroup[] = Array.from(map.entries()).map(([name, groupTracks]) => {
      const sorted = [...groupTracks].sort(
        (a, b) => (a.trackNumber || 999) - (b.trackNumber || 999)
      );
      const coverTrack = sorted.find((t) => Boolean(t.coverUrl));
      const totalDuration = sorted.reduce((acc, t) => acc + (t.duration || 0), 0);
      const latestUpdated = sorted.reduce((acc, t) => Math.max(acc, t.dateAdded || 0), 0);
      const year = sorted.find((t) => Boolean(t.year))?.year || '';
      return {
        name,
        artist: sorted[0]?.artist || 'Various Artists',
        coverUrl: coverTrack?.coverUrl || '/pwa-512x512.png',
        year,
        tracks: sorted,
        totalDuration,
        latestUpdated,
      };
    });

    list.sort((a, b) => {
      switch (sortOption) {
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'songs-asc':
          return a.tracks.length - b.tracks.length;
        case 'songs-desc':
          return b.tracks.length - a.tracks.length;
        case 'duration-asc':
          return a.totalDuration - b.totalDuration;
        case 'duration-desc':
          return b.totalDuration - a.totalDuration;
        case 'year-asc':
          return (a.year || '0').localeCompare(b.year || '0');
        case 'year-desc':
          return (b.year || '0').localeCompare(a.year || '0');
        case 'updated-asc':
          return a.latestUpdated - b.latestUpdated;
        case 'updated-desc':
          return b.latestUpdated - a.latestUpdated;
        case 'artist-asc':
          return a.artist.localeCompare(b.artist);
        case 'artist-desc':
          return b.artist.localeCompare(a.artist);
        case 'name-asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return list;
  }, [tracks, sortOption]);

  const filteredAlbums = useMemo(() => {
    const q = albumQuery.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter(
      (a) => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [albums, albumQuery]);

  const selectedAlbum = selectedAlbumName
    ? albums.find((a) => a.name === selectedAlbumName) || null
    : null;

  const detailAlbumScreen = selectedAlbum ? (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            if (backHandleRef.current) {
              backHandleRef.current.triggerBack();
            } else {
              setSelectedAlbumName(null);
            }
          }}
          className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Back to Albums"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Album Detail
        </span>
      </div>

      {/* Album Hero Banner */}
      <div className="p-4 rounded-3xl bg-white/[0.06] border border-white/15 backdrop-blur-xl flex flex-col sm:flex-row items-center gap-4">
        <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-xl border border-white/15 flex-shrink-0">
          <img
            src={selectedAlbum.coverUrl}
            alt={selectedAlbum.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h2 className="text-lg font-extrabold text-white truncate">{selectedAlbum.name}</h2>
          <p className="text-xs text-cyan-300 font-semibold mt-0.5 truncate">
            {selectedAlbum.artist} {selectedAlbum.year ? `• ${selectedAlbum.year}` : ''}
          </p>
          <p className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
            {selectedAlbum.tracks.length} songs • {formatDurationHMS(selectedAlbum.totalDuration)}
          </p>
          <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
            <button
              type="button"
              onClick={() => onPlayAlbum(selectedAlbum.tracks, false)}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </button>
            <button
              type="button"
              onClick={() => onPlayAlbum(selectedAlbum.tracks, true)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 min-h-[40px]"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {selectedAlbum.tracks.map((tr) => (
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
    </div>
  ) : null;

  const rootAlbumsScreen = (
    <div className="space-y-3">
      {/* Top Bar: Search an album... | Sort | Settings */}
      <div className="flex items-center gap-2 pb-1 border-b border-white/10">
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={albumQuery}
            onChange={(e) => setAlbumQuery(e.target.value)}
            placeholder="Search an album..."
            className="w-full bg-transparent py-2 pl-9 pr-3 text-sm text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onOpenSort();
          }}
          className="p-2 rounded-full hover:bg-white/10 text-slate-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Sort albums by..."
          aria-label="Sort albums"
        >
          <SortAsc className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onOpenSettings();
          }}
          className="p-2 rounded-full hover:bg-white/10 text-slate-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Album grid settings"
          aria-label="Album settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Dense Square Album Artwork Grid */}
      {filteredAlbums.length > 0 ? (
        <div
          className={`grid gap-2 ${
            compactGrid
              ? 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6'
              : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5'
          }`}
        >
          {filteredAlbums.map((alb) => (
            <button
              key={alb.name}
              type="button"
              onClick={() => {
                triggerHaptic(12);
                setSelectedAlbumName(alb.name);
              }}
              className="group rounded-xl overflow-hidden bg-[#181920] border border-white/10 hover:border-violet-400/60 shadow-md transition active:scale-95 flex flex-col text-left"
            >
              <div className="aspect-square w-full overflow-hidden bg-slate-900">
                <img
                  src={alb.coverUrl}
                  alt={alb.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <div className="px-2 py-1.5 w-full bg-[#17181f]">
                <div className="text-[11px] font-semibold text-slate-100 truncate">
                  {alb.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-slate-400">
          <Disc className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          No albums match &ldquo;{albumQuery}&rdquo;.
        </div>
      )}
    </div>
  );

  return (
    <>
      <PredictiveBackContainer
        ref={backHandleRef}
        canGoBack={Boolean(selectedAlbum)}
        onBack={() => setSelectedAlbumName(null)}
        backgroundContent={rootAlbumsScreen}
        foregroundContent={detailAlbumScreen}
      />
      {selectedAlbum ? (
        <FastScroller items={selectedAlbum.tracks} getLabel={(t) => t.title} />
      ) : (
        <FastScroller items={filteredAlbums} getLabel={(a) => a.name} />
      )}
    </>
  );
};
