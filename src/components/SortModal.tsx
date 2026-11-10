import React from 'react';
import { SortAsc } from 'lucide-react';
import { SortOption } from '../types/music';
import { triggerHaptic } from '../services/audioEngine';

interface SortModalProps {
  isOpen: boolean;
  title?: string;
  currentSort: SortOption;
  onSelect: (option: SortOption) => void;
  onClose: () => void;
}

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'name-asc', label: 'Name - ascending' },
  { id: 'name-desc', label: 'Name - descending' },
  { id: 'songs-asc', label: 'Number of songs - ascending' },
  { id: 'songs-desc', label: 'Number of songs - descending' },
  { id: 'duration-asc', label: 'Duration - ascending' },
  { id: 'duration-desc', label: 'Duration - descending' },
  { id: 'year-asc', label: 'Year - ascending' },
  { id: 'year-desc', label: 'Year - descending' },
  { id: 'updated-asc', label: 'Date updated - ascending' },
  { id: 'updated-desc', label: 'Date updated - descending' },
  { id: 'artist-asc', label: 'Artist - ascending' },
  { id: 'artist-desc', label: 'Artist - descending' },
];

export const SortModal: React.FC<SortModalProps> = ({
  isOpen,
  title = 'Sort albums by...',
  currentSort,
  onSelect,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-[#1e2028] border border-white/10 shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[82vh]"
      >
        {/* Header matching Musicolet Screenshot */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3.5 border-b border-white/5">
          <SortAsc className="w-5 h-5 text-slate-300 flex-shrink-0" />
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>

        {/* Scrollable Radio List */}
        <div className="flex-1 overflow-y-auto py-2">
          {SORT_OPTIONS.map((opt) => {
            const selected = currentSort === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  onSelect(opt.id);
                  onClose();
                }}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-white/5 active:bg-white/10 transition text-left min-h-[46px]"
              >
                {/* Radio indicator matching Musicolet violet accent */}
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center border-2 flex-shrink-0 transition ${
                    selected
                      ? 'border-violet-500'
                      : 'border-slate-500'
                  }`}
                >
                  {selected && <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />}
                </span>
                <span
                  className={`text-sm ${
                    selected ? 'text-white font-semibold' : 'text-slate-300 font-normal'
                  }`}
                >
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer matching Screenshot ("CANCEL") */}
        <div className="px-5 py-3 border-t border-white/10 flex justify-end bg-[#191b22]">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold tracking-wider uppercase text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded-xl transition min-h-[40px]"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
};
