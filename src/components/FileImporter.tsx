import React, { useState, useRef } from 'react';
import { Upload, FolderPlus, Music, CheckCircle2, HardDrive, AlertCircle, X } from 'lucide-react';
import { Track } from '../types/music';
import { saveLocalTrackToDB } from '../services/db';
import { generateRealisticWaveform } from '../services/curatedTracks';
import { triggerHaptic } from '../services/audioEngine';
import { extractEmbeddedAlbumArt } from '../services/embeddedArtExtractor';

interface FileImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onTracksImported: (tracks: Track[]) => void;
  existingCount: number;
  autoExtractArt?: boolean;
}

// Extract static waveform density from audio blob with fallback
async function extractAudioWaveform(blob: Blob, seed: string): Promise<number[]> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return generateRealisticWaveform(seed, 36);

    const ctx = new AudioCtx();
    const arrayBuffer = await blob.slice(0, 4 * 1024 * 1024).arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const rawData = audioBuffer.getChannelData(0);
    const samples = 36;
    const blockSize = Math.floor(rawData.length / samples);
    const amplitudes: number[] = [];

    for (let i = 0; i < samples; i++) {
      const blockStart = blockSize * i;
      let sum = 0;
      const step = Math.max(1, Math.floor(blockSize / 25));
      let count = 0;
      for (let j = 0; j < blockSize; j += step) {
        sum += Math.abs(rawData[blockStart + j]);
        count++;
      }
      amplitudes.push(count > 0 ? sum / count : 0.2);
    }

    const peak = Math.max(...amplitudes, 0.02);
    ctx.close().catch(() => {});
    return amplitudes.map((a) => Math.max(0.12, Math.min(0.98, Number((a / peak).toFixed(3)))));
  } catch {
    return generateRealisticWaveform(seed, 36);
  }
}

export const FileImporter: React.FC<FileImporterProps> = ({
  isOpen,
  onClose,
  onTracksImported,
  existingCount,
  autoExtractArt = true,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [importedList, setImportedList] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const parseFilename = (name: string): { title: string; artist: string } => {
    const base = name.replace(/\.[^/.]+$/, '');
    if (base.includes(' - ')) {
      const parts = base.split(' - ');
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(' - ').trim(),
      };
    }
    if (base.includes('_')) {
      const parts = base.split('_');
      if (parts.length > 1) {
        return {
          artist: parts[0].trim(),
          title: parts.slice(1).join(' ').trim(),
        };
      }
    }
    return {
      artist: 'Local Artist',
      title: base,
    };
  };

  const getAudioDuration = (blob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.src = url;

      const cleanup = () => {
        URL.revokeObjectURL(url);
      };

      audio.onloadedmetadata = () => {
        const d = audio.duration;
        cleanup();
        resolve(Number.isFinite(d) ? Math.round(d) : 180);
      };

      audio.onerror = () => {
        cleanup();
        resolve(180);
      };

      setTimeout(() => {
        cleanup();
        resolve(180);
      }, 2500);
    });
  };

  const deriveFolderMetadata = (file: File): { folderPath: string; albumGuess: string } => {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (rel && rel.includes('/')) {
      const segments = rel.split('/').filter(Boolean);
      segments.pop(); // remove filename
      const cleanFolder = `Internal Storage/${segments.join('/')}`;
      const lastFolder = segments[segments.length - 1] || 'My Android Music';
      return { folderPath: cleanFolder, albumGuess: lastFolder };
    }
    return { folderPath: 'Internal Storage/Download', albumGuess: 'My Android Music' };
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    triggerHaptic(20);
    setIsProcessing(true);
    setStatusNote(null);
    const audioFiles: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (
        file.type.startsWith('audio/') ||
        /\.(mp3|wav|ogg|flac|m4a|aac|opus|weba)$/i.test(file.name)
      ) {
        audioFiles.push(file);
      }
    }

    if (audioFiles.length === 0) {
      setStatusNote('No compatible audio files found. Pick MP3, FLAC, WAV, AAC, OGG, or M4A.');
      setIsProcessing(false);
      return;
    }

    const newTracks: Track[] = [];
    const addedNames: string[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      setProgressMsg(`Importing (${i + 1}/${audioFiles.length}): ${file.name}`);

      const { title, artist } = parseFilename(file.name);
      const { folderPath, albumGuess } = deriveFolderMetadata(file);
      const duration = await getAudioDuration(file);
      const waveform = await extractAudioWaveform(file, file.name + file.size);
      const coverUrl = autoExtractArt
        ? await extractEmbeddedAlbumArt(file, title, artist)
        : undefined;

      const track: Track = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        artist,
        album: albumGuess,
        duration,
        url: URL.createObjectURL(file),
        coverUrl,
        isLocal: true,
        source: 'local',
        dateAdded: Date.now(),
        genre: 'Local Audio',
        year: new Date().getFullYear().toString(),
        folderPath,
        playCount: 0,
        mimeType: file.type || 'audio/mpeg',
        fileSize: file.size,
        isFavorite: false,
        waveform,
        fileBlob: file,
      };

      await saveLocalTrackToDB(track);
      newTracks.push(track);
      addedNames.push(track.title);
    }

    setImportedList(addedNames);
    setIsProcessing(false);
    setProgressMsg('');
    triggerHaptic(30);

    onTracksImported(newTracks);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#0f172a] border border-cyan-500/30 p-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Scan & Import Music</h2>
              <p className="text-xs text-slate-400">Add local audio files or music folders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Storage summary */}
        <div className="mt-4 p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-cyan-300">
            <HardDrive className="w-4 h-4" />
            <span>Device Library Storage</span>
          </div>
          <span className="font-mono text-white font-bold tabular-nums">{existingCount} local tracks saved</span>
        </div>

        {statusNote && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
            {statusNote}
          </div>
        )}

        {/* File Select Actions */}
        <div className="mt-4 space-y-3">
          <button
            onClick={() => {
              triggerHaptic(15);
              fileInputRef.current?.click();
            }}
            disabled={isProcessing}
            className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border border-cyan-500/40 hover:border-cyan-400 active:scale-[0.99] transition flex items-center gap-3.5 text-left group"
          >
            <div className="p-3 rounded-xl bg-cyan-500 text-black font-bold group-hover:scale-105 transition">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Select Audio Files</div>
              <div className="text-xs text-slate-300">MP3, FLAC, WAV, AAC, M4A from your device</div>
            </div>
          </button>

          <button
            onClick={() => {
              triggerHaptic(15);
              folderInputRef.current?.click();
            }}
            disabled={isProcessing}
            className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 active:scale-[0.99] transition flex items-center gap-3.5 text-left group"
          >
            <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400 font-bold group-hover:scale-105 transition">
              <FolderPlus className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Scan Music Folder</div>
              <div className="text-xs text-slate-300">Import folders & preserve subfolder tree</div>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is standard in Chromium / Android Chrome
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </div>

        {isProcessing && (
          <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-cyan-500/30 text-center">
            <div className="text-xs font-semibold text-cyan-300 mb-1">{progressMsg}</div>
            <div className="text-[11px] text-slate-400">Extracting artwork, waveforms & folder hierarchy...</div>
          </div>
        )}

        {importedList.length > 0 && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 max-h-36 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Added {importedList.length} tracks to Prime One library:</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1">
              {importedList.map((t, idx) => (
                <li key={idx} className="truncate">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 text-[11px] text-slate-400 flex items-start gap-1.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-slate-500 mt-0.5" />
          <span>
            Tracks are saved in offline device storage. Connect your Google Account in Settings to upload songs to Google Drive and sync tags across devices.
          </span>
        </div>

        <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
          >
            {importedList.length > 0 ? 'Done & Listen' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
