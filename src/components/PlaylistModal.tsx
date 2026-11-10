import React, { useState } from 'react';
import { ListMusic, Plus, X, Trash2, Music, Check } from 'lucide-react';
import { Playlist, Track } from '../types/music';
import { triggerHaptic } from '../services/audioEngine';
import { WaveformPreview } from './WaveformPreview';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  allTracks: Track[];
  onPlayTrack: (track: Track) => void;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveTrackFromPlaylist: (playlistId: string, trackId: string) => void;
}

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  onClose,
  playlists,
  allTracks,
  onPlayTrack,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
}) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    playlists[0]?.id || null
  );
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingTrack, setIsAddingTrack] = useState(false);

  if (!isOpen) return null;

  const currentPlaylist = playlists.find((p) => p.id === selectedPlaylistId) || playlists[0];
  const playlistTracks = currentPlaylist
    ? currentPlaylist.trackIds
        .map((id) => allTracks.find((t) => t.id === id))
        .filter((t): t is Track => Boolean(t))
    : [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    triggerHaptic(20);
    onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#0f172a] border border-cyan-500/30 p-5 shadow-2xl text-slate-100 max-h-[90vh] flex flex-col">
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <ListMusic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Custom Playlists</h2>
              <p className="text-xs text-slate-400">Organize your Android sound library</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Playlists Horizontal Bar */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {playlists.map((pl) => {
            const isSelected = pl.id === currentPlaylist?.id;
            return (
              <button
                key={pl.id}
                onClick={() => {
                  triggerHaptic(10);
                  setSelectedPlaylistId(pl.id);
                  setIsAddingTrack(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                  isSelected
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
                }`}
              >
                {pl.name} ({pl.trackIds.length})
              </button>
            );
          })}

          <button
            onClick={() => {
              triggerHaptic(15);
              setIsCreating(!isCreating);
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-white/10 border border-white/10 text-cyan-300 hover:bg-white/20 transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Playlist</span>
          </button>
        </div>

        {/* Create Playlist Inline Form */}
        {isCreating && (
          <form onSubmit={handleCreate} className="mt-3 p-3 bg-white/5 rounded-2xl border border-white/10 flex gap-2">
            <input
              type="text"
              placeholder="e.g. Gym Workout, Night Drives..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-cyan-500 text-black text-xs font-bold rounded-xl hover:bg-cyan-400 transition"
            >
              Create
            </button>
          </form>
        )}

        {/* Current Playlist Content */}
        {currentPlaylist && (
          <div className="mt-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <h3 className="text-sm font-bold text-white">{currentPlaylist.name}</h3>
                <span className="text-[11px] text-slate-400">{playlistTracks.length} tracks</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddingTrack(!isAddingTrack)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Songs</span>
                </button>

                {playlists.length > 1 && (
                  <button
                    onClick={() => {
                      triggerHaptic(20);
                      onDeletePlaylist(currentPlaylist.id);
                    }}
                    className="p-1 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                    title="Delete Playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Song picker mode */}
            {isAddingTrack ? (
              <div className="space-y-1.5 p-2 bg-black/40 rounded-2xl border border-white/10 max-h-56 overflow-y-auto">
                <div className="text-[11px] font-semibold text-slate-400 px-2 pb-1">
                  Tap to add/remove track:
                </div>
                {allTracks.map((track) => {
                  const inPlaylist = currentPlaylist.trackIds.includes(track.id);
                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        triggerHaptic(10);
                        if (inPlaylist) {
                          onRemoveTrackFromPlaylist(currentPlaylist.id, track.id);
                        } else {
                          onAddTrackToPlaylist(currentPlaylist.id, track.id);
                        }
                      }}
                      className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${
                        inPlaylist ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 truncate text-xs">
                        <span className="font-bold text-white">{track.title}</span>
                        <span className="text-slate-400 ml-2">• {track.artist}</span>
                      </div>
                      {inPlaylist && <Check className="w-4 h-4 text-cyan-400" />}
                    </div>
                  );
                })}
              </div>
            ) : playlistTracks.length > 0 ? (
              <div className="space-y-1.5">
                {playlistTracks.map((track, idx) => (
                  <div
                    key={track.id}
                    onClick={() => {
                      triggerHaptic(15);
                      onPlayTrack(track);
                      onClose();
                    }}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-between cursor-pointer group transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-xs font-mono text-slate-500 w-4 text-center">{idx + 1}</span>
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0">
                        <img
                          src={track.coverUrl || '/pwa-512x512.png'}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate group-hover:text-cyan-300">
                          {track.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{track.artist}</div>
                        <div className="mt-1 w-28 sm:w-36">
                          <WaveformPreview
                            waveform={track.waveform}
                            seed={track.id + track.title}
                            barCount={20}
                            height={12}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic(15);
                        onRemoveTrackFromPlaylist(currentPlaylist.id, track.id);
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-400 opacity-60 group-hover:opacity-100 transition"
                      title="Remove from playlist"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Music className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                <p className="text-xs">This playlist is empty.</p>
                <button
                  onClick={() => setIsAddingTrack(true)}
                  className="mt-2 text-xs font-bold text-cyan-400 hover:underline"
                >
                  + Add songs from your library
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
