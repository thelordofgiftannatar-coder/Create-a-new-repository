import React, { useState, useMemo, useRef } from 'react';
import { User, Search, SortAsc, ArrowLeft, Play } from 'lucide-react';
import { Track, Playlist, SortOption } from '../types/music';
import { formatDurationHMS, triggerHaptic } from '../services/audioEngine';
import { TrackListItem } from './TrackListItem';
import { PredictiveBackContainer, PredictiveBackHandle } from './PredictiveBackContainer';
import { FastScroller } from './FastScroller';

interface ArtistsViewProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackProgress: number;
  showWaveforms: boolean;
  sortOption: SortOption;
  playlists: Playlist[];
  canUploadToDrive: boolean;
  onOpenSort: () => void;
  onSelectTrack: (track: Track) => void;
  onPlayArtist: (tracks: Track[]) => void;
  onToggleFavorite: (trackId: string) => void;
  onEditTags: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onUploadToDrive?: (track: Track) => void;
  onDeleteLocal?: (trackId: string) => void;
}

export const ArtistsView: React.FC<ArtistsViewProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  playbackProgress,
  showWaveforms,
  sortOption,
  playlists,
  canUploadToDrive,
  onOpenSort,
  onSelectTrack,
  onPlayArtist,
  onToggleFavorite,
  onEditTags,
  onAddToQueue,
  onAddToPlaylist,
  onUploadToDrive,
  onDeleteLocal,
}) => {
  const [query, setQuery] = useState('');
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const backHandleRef = useRef<PredictiveBackHandle | null>(null);

  const artists = useMemo(() => {
    const map = new Map<string, Track[]>();
    tracks.forEach((tr) => {
      const name = (tr.artist || 'Unknown Artist').trim();
      const arr = map.get(name) || [];
      arr.push(tr);
      map.set(name, arr);
    });

    const list = Array.from(map.entries()).map(([name, arr]) => ({
      name,
      tracks: arr,
      coverUrl: arr.find((t) => Boolean(t.coverUrl))?.coverUrl || '/pwa-512x512.png',
      totalDuration: arr.reduce((acc, t) => acc + (t.duration || 0), 0),
    }));

    list.sort((a, b) => {
      if (sortOption === 'name-desc' || sortOption === 'artist-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortOption === 'songs-asc') return a.tracks.length - b.tracks.length;
      if (sortOption === 'songs-desc') return b.tracks.length - a.tracks.length;
      if (sortOption === 'duration-desc') return b.totalDuration - a.totalDuration;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [tracks, sortOption]);

  const filteredArtists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, query]);

  const activeArtistGroup = selectedArtist
    ? artists.find((a) => a.name === selectedArtist) || null
    : null;

  const detailArtistScreen = activeArtistGroup ? (
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
                setSelectedArtist(null);
              }
            }}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Back to Artists"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">{activeArtistGroup.name}</h2>
            <div className="text-[11px] text-slate-400 tabular-nums">
              {activeArtistGroup.tracks.length} songs •{' '}
              {formatDurationHMS(activeArtistGroup.totalDuration)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onPlayArtist(activeArtistGroup.tracks)}
          className="px-3.5 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold flex items-center gap-1.5 min-h-[40px] flex-shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Play All</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {activeArtistGroup.tracks.map((tr) => (
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

  const rootArtistsScreen = (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-1 border-b border-white/10">
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an artist..."
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
          title="Sort artists"
          aria-label="Sort artists"
        >
          <SortAsc className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2">
        {filteredArtists.map((art) => (
          <button
            key={art.name}
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setSelectedArtist(art.name);
            }}
            className="w-full p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 flex items-center justify-between gap-3 transition text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-800 border border-white/15 flex-shrink-0">
                <img
                  src={art.coverUrl}
                  alt={art.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{art.name}</div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {art.tracks.length} {art.tracks.length === 1 ? 'song' : 'songs'} •{' '}
                  {formatDurationHMS(art.totalDuration)}
                </div>
              </div>
            </div>
            <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <PredictiveBackContainer
        ref={backHandleRef}
        canGoBack={Boolean(activeArtistGroup)}
        onBack={() => setSelectedArtist(null)}
        backgroundContent={rootArtistsScreen}
        foregroundContent={detailArtistScreen}
      />
      {activeArtistGroup ? (
        <FastScroller items={activeArtistGroup.tracks} getLabel={(t) => t.title} />
      ) : (
        <FastScroller items={filteredArtists} getLabel={(a) => a.name} />
      )}
    </>
  );
};
