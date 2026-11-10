import React, { useState, useMemo } from 'react';
import { Tag, Search, Edit3, Images, Sparkles } from 'lucide-react';
import { Track } from '../types/music';
import { triggerHaptic } from '../services/audioEngine';
import { FastScroller } from './FastScroller';

interface TagsManagerViewProps {
  tracks: Track[];
  onEditTags: (track: Track) => void;
  hasGooglePhotosAccess: boolean;
  onOpenCloudModal: () => void;
}

export const TagsManagerView: React.FC<TagsManagerViewProps> = ({
  tracks,
  onEditTags,
  hasGooglePhotosAccess,
  onOpenCloudModal,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'no-lyrics' | 'no-year'>('all');

  const filtered = useMemo(() => {
    let list = tracks;
    if (filter === 'no-lyrics') {
      list = list.filter((t) => !t.lyrics);
    } else if (filter === 'no-year') {
      list = list.filter((t) => !t.year);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        (t.genre || '').toLowerCase().includes(q)
    );
  }, [tracks, query, filter]);

  return (
    <div className="space-y-3">
      {/* Header Card */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-violet-500/20 to-cyan-500/15 border border-violet-400/30 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-violet-300" />
            <span>ID3 Tag &amp; Cover Artwork Studio</span>
          </h2>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Tap any song to modify title, artist, album, lyrics, or assign cover art directly from Google Photos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            onOpenCloudModal();
          }}
          className={`px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 flex-shrink-0 ${
            hasGooglePhotosAccess
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
              : 'bg-white text-black'
          }`}
        >
          <Images className="w-3.5 h-3.5" />
          <span>{hasGooglePhotosAccess ? 'Photos Ready' : 'Connect Photos'}</span>
        </button>
      </div>

      {/* Search & Filter Row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter songs to edit tags..."
            className="w-full bg-black/45 border border-white/15 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-400"
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          {(
            [
              { id: 'all', label: 'All Songs' },
              { id: 'no-lyrics', label: 'No Lyrics' },
              { id: 'no-year', label: 'No Year' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-2.5 py-2 rounded-xl border font-semibold whitespace-nowrap ${
                filter === f.id
                  ? 'bg-violet-500 text-white border-violet-400'
                  : 'bg-white/5 text-slate-300 border-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editable Tracks List */}
      <div className="space-y-2">
        {filtered.map((tr) => (
          <button
            key={tr.id}
            type="button"
            onClick={() => {
              triggerHaptic(15);
              onEditTags(tr);
            }}
            className="w-full p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 flex items-center justify-between gap-3 transition text-left"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 border border-white/15 flex-shrink-0">
                <img
                  src={tr.coverUrl || '/pwa-512x512.png'}
                  alt={tr.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{tr.title}</div>
                <div className="text-[11px] text-slate-300 truncate">
                  {tr.artist} • {tr.album}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                  {tr.genre && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {tr.genre}
                    </span>
                  )}
                  {tr.year && (
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                      {tr.year}
                    </span>
                  )}
                  {tr.lyrics && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Lyrics</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/30 text-xs font-bold flex items-center gap-1.5 flex-shrink-0">
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </div>
          </button>
        ))}
      </div>

      <FastScroller items={filtered} getLabel={(t) => t.title} />
    </div>
  );
};
