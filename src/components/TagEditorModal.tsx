import React, { useState, useRef, useEffect } from 'react';
import {
  Tag,
  X,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Check,
  RefreshCw,
  FolderOpen,
  Link2,
  Images,
  Cloud,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Track } from '../types/music';
import { triggerHaptic } from '../services/audioEngine';
import {
  extractEmbeddedAlbumArt,
  generateProceduralAlbumArt,
} from '../services/embeddedArtExtractor';
import {
  DriveMediaItem,
  listGooglePhotosImages,
  downloadDriveFileAsBlob,
  imageBlobToCompactArtwork,
  openGooglePhotosAndImagesPicker,
} from '../services/googleWorkspace';
import { GoogleSignInButton } from './GoogleSignInButton';

interface TagEditorModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveTags: (updatedTrack: Track, applyCoverToAlbum: boolean) => Promise<void> | void;
  user: User | null;
  accessToken: string | null;
  onGoogleSignedIn: (user: User, token: string) => void;
}

type ArtworkSourceTab = 'photos' | 'device' | 'extract' | 'url';

export const TagEditorModal: React.FC<TagEditorModalProps> = ({
  track,
  isOpen,
  onClose,
  onSaveTags,
  user,
  accessToken,
  onGoogleSignedIn,
}) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [year, setYear] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  const [genre, setGenre] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [applyCoverToAlbum, setApplyCoverToAlbum] = useState(false);

  const [artTab, setArtTab] = useState<ArtworkSourceTab>('photos');
  const [photosItems, setPhotosItems] = useState<DriveMediaItem[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [artStatus, setArtStatus] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const localPhotoRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (track && isOpen) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setYear(track.year || '');
      setTrackNumber(track.trackNumber !== undefined ? String(track.trackNumber) : '');
      setGenre(track.genre || '');
      setFolderPath(track.folderPath || 'Internal Storage/Music');
      setLyrics(track.lyrics || '');
      setCoverUrl(track.coverUrl || '');
      setUrlInput(track.coverUrl && track.coverUrl.startsWith('http') ? track.coverUrl : '');
      setApplyCoverToAlbum(false);
      setArtStatus(null);
    }
  }, [track, isOpen]);

  const loadGooglePhotos = async (tokenToUse: string) => {
    setLoadingPhotos(true);
    setArtStatus(null);
    try {
      const items = await listGooglePhotosImages(tokenToUse);
      setPhotosItems(items);
      if (items.length === 0) {
        setArtStatus('No photos returned in preview list. Try launching the full Google Photos Picker below.');
      }
    } catch (err) {
      setArtStatus(err instanceof Error ? err.message : 'Failed to load Google Photos.');
    } finally {
      setLoadingPhotos(false);
    }
  };

  useEffect(() => {
    if (isOpen && artTab === 'photos' && accessToken && photosItems.length === 0) {
      loadGooglePhotos(accessToken);
    }
  }, [isOpen, artTab, accessToken]);

  if (!isOpen || !track) return null;

  const handleSelectPhotoItem = async (item: DriveMediaItem) => {
    if (!accessToken) return;
    triggerHaptic(15);
    setArtStatus(`Downloading artwork "${item.name}"...`);
    try {
      const blob = await downloadDriveFileAsBlob(accessToken, item.id);
      const compactDataUrl = await imageBlobToCompactArtwork(blob, 480);
      setCoverUrl(compactDataUrl);
      setArtStatus(`Applied "${item.name}" from Google Photos / Drive.`);
    } catch {
      if (item.thumbnailLink) {
        setCoverUrl(item.thumbnailLink.replace(/=s\d+/, '=s512'));
        setArtStatus(`Applied thumbnail preview for "${item.name}".`);
      } else {
        setArtStatus('Could not decode selected Google Photo.');
      }
    }
  };

  const handleLaunchGooglePhotosPicker = async () => {
    if (!accessToken) return;
    triggerHaptic(15);
    setArtStatus('Opening Google Photos & Drive Picker...');
    try {
      await openGooglePhotosAndImagesPicker(accessToken, async (picked) => {
        setArtStatus(`Importing "${picked.name}"...`);
        try {
          const blob = await downloadDriveFileAsBlob(accessToken, picked.id);
          const compact = await imageBlobToCompactArtwork(blob, 480);
          setCoverUrl(compact);
          setArtStatus(`Updated song artwork with "${picked.name}".`);
        } catch {
          if (picked.url) {
            setCoverUrl(picked.url);
            setArtStatus(`Selected "${picked.name}" URL.`);
          } else {
            setArtStatus('Picked image could not be downloaded directly. Try choosing from the list or uploading from device.');
          }
        }
      });
    } catch (err) {
      setArtStatus(err instanceof Error ? err.message : 'Google Picker unavailable.');
    }
  };

  const handleDevicePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    triggerHaptic(20);
    setArtStatus('Optimizing image for ID3 & cloud sync...');
    try {
      const compact = await imageBlobToCompactArtwork(file, 480);
      setCoverUrl(compact);
      setArtStatus(`Loaded local image "${file.name}".`);
    } catch (err) {
      setArtStatus(err instanceof Error ? err.message : 'Could not read image.');
    }
  };

  const handleExtractOrGenerateArt = async (mode: 'id3' | 'procedural') => {
    triggerHaptic(15);
    if (mode === 'id3' && track.fileBlob instanceof File) {
      const extracted = await extractEmbeddedAlbumArt(
        track.fileBlob,
        title || track.title,
        artist || track.artist
      );
      setCoverUrl(extracted);
      setArtStatus('Extracted embedded cover art from audio header.');
    } else {
      const generated = generateProceduralAlbumArt(
        title || track.title,
        artist || track.artist
      );
      setCoverUrl(generated);
      setArtStatus('Generated high-resolution vinyl master cover art.');
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    triggerHaptic(15);
    setCoverUrl(urlInput.trim());
    setArtStatus('Applied custom image URL.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(20);
    setIsSaving(true);
    try {
      const parsedTrackNum = trackNumber.trim() ? Number(trackNumber.trim()) : undefined;
      const updatedTrack: Track = {
        ...track,
        title: title.trim() || track.title,
        artist: artist.trim() || 'Unknown Artist',
        album: album.trim() || 'Prime One Library',
        year: year.trim() || undefined,
        trackNumber:
          parsedTrackNum !== undefined && Number.isFinite(parsedTrackNum)
            ? parsedTrackNum
            : undefined,
        genre: genre.trim() || undefined,
        folderPath: folderPath.trim() || 'Internal Storage/Music',
        lyrics: lyrics.trim() || undefined,
        coverUrl: coverUrl || track.coverUrl,
      };
      await onSaveTags(updatedTrack, applyCoverToAlbum);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0d1424]/98 border border-cyan-500/30 p-5 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col"
      >
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Edit Tags & Album Art</h2>
              <p className="text-[11px] text-slate-400">
                Modify ID3 metadata & pick art from Google Photos or device
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Close tag editor"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
          {/* Artwork Preview & Selector Card */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-3">
            <div className="flex items-center gap-3.5">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-900 border border-white/15 flex-shrink-0 shadow-lg relative">
                <img
                  src={coverUrl || '/pwa-512x512.png'}
                  alt={title || track.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="text-xs font-bold text-white">Song Cover Artwork</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setArtTab('photos')}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border transition flex items-center justify-center gap-1 ${
                      artTab === 'photos'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <Images className="w-3.5 h-3.5" />
                    <span>Google Photos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setArtTab('device')}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border transition flex items-center justify-center gap-1 ${
                      artTab === 'device'
                        ? 'bg-purple-500/20 border-purple-400 text-purple-300'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Device</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setArtTab('extract')}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border transition flex items-center justify-center gap-1 ${
                      artTab === 'extract'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto Art</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setArtTab('url')}
                    className={`px-2 py-1.5 rounded-xl text-[11px] font-semibold border transition flex items-center justify-center gap-1 ${
                      artTab === 'url'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>URL</span>
                  </button>
                </div>
              </div>
            </div>

            {artStatus && (
              <div className="text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl">
                {artStatus}
              </div>
            )}

            {/* Google Photos Artwork Source */}
            {artTab === 'photos' && (
              <div className="pt-2 border-t border-white/10 space-y-2.5">
                {!accessToken ? (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-start gap-2.5">
                    <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-cyan-400" />
                      <span>
                        {user
                          ? 'Reconnect your Google Account to browse Google Photos for album artwork.'
                          : 'Sign in with Google to pick song artwork directly from Google Photos & Drive.'}
                      </span>
                    </div>
                    <GoogleSignInButton
                      compact
                      label={user ? 'Reconnect Google Photos' : 'Sign in with Google'}
                      onSuccess={(u, tok) => {
                        onGoogleSignedIn(u, tok);
                        loadGooglePhotos(tok);
                      }}
                      onError={(err) => setArtStatus(err)}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleLaunchGooglePhotosPicker}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition"
                      >
                        <Images className="w-3.5 h-3.5" />
                        <span>Open Google Photos Picker</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => loadGooglePhotos(accessToken)}
                        disabled={loadingPhotos}
                        className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 flex items-center gap-1"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingPhotos ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>

                    {photosItems.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pt-1">
                        {photosItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectPhotoItem(item)}
                            className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-cyan-400 bg-slate-900"
                            title={item.name}
                          >
                            {item.thumbnailLink ? (
                              <img
                                src={item.thumbnailLink}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-500">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Local Device Photo Source */}
            {artTab === 'device' && (
              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Choose any PNG, JPG, or WEBP image from your phone gallery.
                </span>
                <button
                  type="button"
                  onClick={() => localPhotoRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Photo</span>
                </button>
                <input
                  ref={localPhotoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleDevicePhotoChange}
                />
              </div>
            )}

            {/* Embedded ID3 / Procedural Cover */}
            {artTab === 'extract' && (
              <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2">
                {track.fileBlob && (
                  <button
                    type="button"
                    onClick={() => handleExtractOrGenerateArt('id3')}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-semibold"
                  >
                    Re-extract ID3 Art
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleExtractOrGenerateArt('procedural')}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Generate Vinyl Master Cover</span>
                </button>
              </div>
            )}

            {/* External URL */}
            {artTab === 'url' && (
              <div className="pt-2 border-t border-white/10 flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/album-cover.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold"
                >
                  Apply
                </button>
              </div>
            )}

            {/* Apply Cover to Entire Album toggle */}
            <label className="flex items-center gap-2 pt-2 border-t border-white/5 text-[11px] text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={applyCoverToAlbum}
                onChange={(e) => setApplyCoverToAlbum(e.target.checked)}
                className="rounded accent-violet-500"
              />
              <span>Apply this artwork to all songs in &ldquo;{album || track.album}&rdquo;</span>
            </label>
          </div>

          {/* Standard Tag Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Year</label>
              <input
                type="text"
                placeholder="2026"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Track #</label>
              <input
                type="number"
                min={0}
                max={999}
                placeholder="1"
                value={trackNumber}
                onChange={(e) => setTrackNumber(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mb-1">
                <FolderOpen className="w-3 h-3" />
                <span>Folder Path</span>
              </label>
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Synchronized / Static Lyrics (optional [mm:ss.xx])
              </label>
              <textarea
                rows={3}
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="[00:00.00] Paste or edit lyrics here..."
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-400"
              />
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-xs font-bold text-white shadow-lg flex items-center justify-center gap-1.5 min-h-[44px] disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Tags & Sync'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
