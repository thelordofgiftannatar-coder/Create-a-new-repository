import React, { useState } from 'react';
import {
  Heart,
  Trash2,
  Tag,
  MoreVertical,
  ListPlus,
  Cloud,
  UploadCloud,
  Check,
} from 'lucide-react';
import { Track, Playlist } from '../types/music';
import { audioEngine, triggerHaptic } from '../services/audioEngine';
import { WaveformPreview } from './WaveformPreview';

interface TrackListItemProps {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  playbackProgress: number;
  showWaveforms: boolean;
  playlists: Playlist[];
  canUploadToDrive: boolean;
  diyStyle?: import('../types/themeLandscape').DiyPlayerStyle;
  onSelect: (track: Track) => void;
  onToggleFavorite: (trackId: string) => void;
  onEditTags: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onUploadToDrive?: (track: Track) => void;
  onDeleteLocal?: (trackId: string) => void;
}

const formatDuration = (secs: number) => {
  const safe = Math.max(0, Math.floor(secs || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const TrackListItem: React.FC<TrackListItemProps> = ({
  track,
  isCurrent,
  isPlaying,
  playbackProgress,
  showWaveforms,
  playlists,
  canUploadToDrive,
  diyStyle,
  onSelect,
  onToggleFavorite,
  onEditTags,
  onAddToQueue,
  onAddToPlaylist,
  onUploadToDrive,
  onDeleteLocal,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const artShapeClass =
    diyStyle?.widgetArtShape === 'circle'
      ? 'rounded-full'
      : diyStyle?.widgetArtShape === 'square'
      ? 'rounded-md'
      : 'rounded-xl';

  return (
    <div
      onClick={() => onSelect(track)}
      style={
        isCurrent
          ? {
              borderColor: 'var(--prime-accent)',
              backgroundColor: 'color-mix(in srgb, var(--prime-accent) 12%, rgba(7, 11, 20, 0.72))',
            }
          : undefined
      }
      className={`prime-card relative group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 backdrop-blur-xl ${
        isCurrent
          ? 'border-cyan-400/60 shadow-xl shadow-cyan-500/10'
          : 'bg-white/[0.06] hover:bg-white/[0.11] border-white/10 hover:border-white/20 shadow-lg shadow-black/20'
      }`}
    >
      {/* Top Row: Cover Art, Metadata, Controls */}
      <div className="flex items-center justify-between w-full gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`relative w-12 h-12 ${artShapeClass} overflow-hidden bg-slate-800 flex-shrink-0 shadow-md border border-white/10`}>
            <img
              src={track.coverUrl || '/pwa-512x512.png'}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            {isCurrent && isPlaying && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <span
                  className="w-2.5 h-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: 'var(--prime-accent)' }}
                />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h4
                style={isCurrent ? { color: 'var(--prime-accent)' } : undefined}
                className={`text-xs sm:text-sm font-bold truncate ${
                  isCurrent ? '' : 'text-white group-hover:text-cyan-200'
                }`}
              >
                {track.title}
              </h4>
              {track.driveFileId && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold flex items-center gap-0.5 flex-shrink-0"
                  title="Stored in Google Drive"
                >
                  <Cloud className="w-2.5 h-2.5" />
                  <span>Cloud</span>
                </span>
              )}
              {track.isLocal && !track.driveFileId && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium flex-shrink-0">
                  Device
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
              <span className="truncate">{track.artist}</span>
              {track.album && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="truncate">{track.album}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className="flex items-center gap-0.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[11px] font-mono text-slate-400 mr-1 hidden sm:inline tabular-nums">
            {formatDuration(track.duration)}
          </span>

          <button
            type="button"
            onClick={() => onToggleFavorite(track.id)}
            className={`prime-icon-btn p-2 rounded-full transition active:scale-90 min-w-[38px] min-h-[38px] flex items-center justify-center ${
              track.isFavorite
                ? 'text-pink-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label="Toggle favorite"
          >
            <Heart className={`w-4 h-4 ${track.isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onEditTags(track);
            }}
            className="prime-icon-btn p-2 rounded-full text-slate-400 hover:text-violet-300 transition min-w-[38px] min-h-[38px] flex items-center justify-center"
            title="Edit tags & cover art"
            aria-label="Edit tags"
          >
            <Tag className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(10);
                setMenuOpen((prev) => !prev);
              }}
              className="prime-icon-btn p-2 rounded-full text-slate-400 hover:text-white transition min-w-[38px] min-h-[38px] flex items-center justify-center"
              aria-label="More track options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 z-40 w-52 rounded-2xl bg-[#181b25] border border-white/15 shadow-2xl p-1.5 text-xs text-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onAddToQueue(track);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-left"
                >
                  <ListPlus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Add to Queue</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onEditTags(track);
                  }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-left"
                >
                  <Tag className="w-3.5 h-3.5 text-violet-400" />
                  <span>Edit Tags &amp; Cover Art</span>
                </button>

                {canUploadToDrive && track.fileBlob && !track.driveFileId && onUploadToDrive && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onUploadToDrive(track);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-white/10 flex items-center gap-2 text-left"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
                    <span>Upload to Google Drive</span>
                  </button>
                )}

                {playlists.length > 0 && (
                  <div className="my-1 pt-1 border-t border-white/10">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase text-slate-500">
                      Add to playlist
                    </div>
                    {playlists.slice(0, 4).map((pl) => {
                      const inPl = pl.trackIds.includes(track.id);
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onAddToPlaylist(pl.id, track.id);
                          }}
                          className="w-full px-3 py-1.5 rounded-xl hover:bg-white/10 flex items-center justify-between text-left"
                        >
                          <span className="truncate">{pl.name}</span>
                          {inPl && <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {track.isLocal && onDeleteLocal && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteLocal(track.id);
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-red-500/20 text-red-300 flex items-center gap-2 text-left mt-1 border-t border-white/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete from device</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Preserved Static Audio Density Waveform */}
      {showWaveforms && (
        <div className="w-full pt-1.5 border-t border-white/[0.05]">
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mb-1">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCurrent && isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span className="uppercase tracking-wider">Audio Density Preview</span>
            </span>
            <span className="text-[10px] text-slate-400 sm:hidden tabular-nums">
              {formatDuration(track.duration)}
            </span>
            {isCurrent && isPlaying && (
              <span className="text-cyan-400 font-semibold hidden sm:inline">Now Playing</span>
            )}
          </div>
          <WaveformPreview
            waveform={track.waveform}
            seed={track.id + track.title}
            progress={isCurrent ? playbackProgress : 0}
            isCurrent={isCurrent}
            isPlaying={isPlaying}
            barCount={36}
            height={18}
            showDensityBadge={true}
            onSeek={
              isCurrent
                ? (ratio) => {
                    triggerHaptic(10);
                    const target = ratio * (audioEngine.getDuration() || track.duration || 1);
                    audioEngine.seek(target);
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
};
