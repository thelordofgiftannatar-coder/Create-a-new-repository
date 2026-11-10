import React, { useState, useEffect } from 'react';
import {
  Cloud,
  X,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  FolderSearch,
  Trash2,
  Play,
  HardDrive,
  CheckCircle2,
  FileAudio,
  ShieldCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  Track,
  Playlist,
  EqualizerSettings,
  PrimeOneSettings,
} from '../types/music';
import { LandscapeThemeConfig } from '../types/themeLandscape';
import {
  DriveMediaItem,
  listDriveAudioFiles,
  downloadDriveFileAsBlob,
  uploadAudioToDrive,
  deleteDriveFile,
  saveBackupToDrive,
  restoreBackupFromDrive,
  openGoogleDriveAudioPicker,
  PrimeOneCloudBackup,
} from '../services/googleWorkspace';
import { generateRealisticWaveform } from '../services/curatedTracks';
import { saveLocalTrackToDB } from '../services/db';
import { triggerHaptic } from '../services/audioEngine';
import { GoogleAccountBanner } from './GoogleSignInButton';
import { ConfirmActionConfig } from './ConfirmActionModal';

interface CloudDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  accessToken: string | null;
  needsWorkspaceReauth: boolean;
  onGoogleSignedIn: (user: User, token: string) => void;
  onGoogleSignedOut: () => void;
  tracks: Track[];
  playlists: Playlist[];
  eqSettings: EqualizerSettings;
  landscapeConfig: LandscapeThemeConfig;
  playerSettings: PrimeOneSettings;
  onTrackAddedOrUpdated: (track: Track) => void;
  onPlayTrack: (track: Track) => void;
  onRestoreBackupData: (backup: PrimeOneCloudBackup) => void;
  onRequestConfirm: (cfg: ConfirmActionConfig) => void;
  setConfirmBusy: (busy: boolean) => void;
}

export const CloudDriveModal: React.FC<CloudDriveModalProps> = ({
  isOpen,
  onClose,
  user,
  accessToken,
  needsWorkspaceReauth,
  onGoogleSignedIn,
  onGoogleSignedOut,
  tracks,
  playlists,
  eqSettings,
  landscapeConfig,
  playerSettings,
  onTrackAddedOrUpdated,
  onPlayTrack,
  onRestoreBackupData,
  onRequestConfirm,
  setConfirmBusy,
}) => {
  const [tab, setTab] = useState<'drive' | 'upload' | 'sync'>('drive');
  const [driveFiles, setDriveFiles] = useState<DriveMediaItem[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadDriveFiles = async (tokenToUse: string) => {
    setLoadingDrive(true);
    setErrorMsg(null);
    try {
      const files = await listDriveAudioFiles(tokenToUse);
      setDriveFiles(files);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not fetch Google Drive files.');
    } finally {
      setLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (isOpen && accessToken && driveFiles.length === 0) {
      loadDriveFiles(accessToken);
    }
  }, [isOpen, accessToken]);

  if (!isOpen) return null;

  const localUploadCandidates = tracks.filter((t) => t.fileBlob && !t.driveFileId);

  const handleImportDriveItem = async (item: DriveMediaItem, autoPlay = false) => {
    if (!accessToken) return;
    triggerHaptic(15);
    setErrorMsg(null);
    setStatusMessage(`Downloading "${item.name}" from Google Drive...`);
    try {
      const blob = await downloadDriveFileAsBlob(accessToken, item.id);
      const url = URL.createObjectURL(blob);
      const baseTitle = item.name.replace(/\.[^/.]+$/, '');
      const existing = tracks.find((t) => t.driveFileId === item.id);

      const hydrated: Track = {
        id: existing?.id || `drive-${item.id}`,
        title: existing?.title || baseTitle,
        artist: existing?.artist || 'Google Drive Cloud',
        album: existing?.album || 'Prime One Music',
        duration: existing?.duration || 180,
        url,
        coverUrl: existing?.coverUrl,
        isLocal: true,
        source: 'drive',
        driveFileId: item.id,
        mimeType: item.mimeType,
        fileSize: item.size ? Number(item.size) : blob.size,
        dateAdded: existing?.dateAdded || Date.now(),
        folderPath: existing?.folderPath || 'Google Drive/Prime One Music',
        playCount: existing?.playCount || 0,
        isFavorite: existing?.isFavorite || false,
        waveform: existing?.waveform || generateRealisticWaveform(baseTitle, 36),
        fileBlob: blob,
      };

      await saveLocalTrackToDB(hydrated);
      onTrackAddedOrUpdated(hydrated);
      setStatusMessage(`Cached "${hydrated.title}" offline in Prime One!`);
      if (autoPlay) {
        onPlayTrack(hydrated);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Download from Drive failed.');
    }
  };

  const handlePickFromDrive = async () => {
    if (!accessToken) return;
    triggerHaptic(15);
    try {
      await openGoogleDriveAudioPicker(accessToken, async (pickedFiles) => {
        for (const pf of pickedFiles) {
          await handleImportDriveItem(
            { id: pf.id, name: pf.name, mimeType: pf.mimeType },
            pickedFiles.length === 1
          );
        }
        loadDriveFiles(accessToken);
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Google Drive Picker failed to load.');
    }
  };

  const handleUploadTrackWithConfirmation = (track: Track) => {
    if (!accessToken || !track.fileBlob) return;
    const ext = track.mimeType?.includes('flac')
      ? '.flac'
      : track.mimeType?.includes('wav')
      ? '.wav'
      : track.mimeType?.includes('mp4') || track.mimeType?.includes('m4a')
      ? '.m4a'
      : '.mp3';
    const fileName = `${track.artist} - ${track.title}${ext}`.replace(/[\\/:*?"<>|]/g, '_');

    onRequestConfirm({
      title: 'Upload Audio to Google Drive?',
      description: `Upload "${track.title}" to the "Prime One Music" folder in your Google Drive so you can access and play it across devices?`,
      confirmLabel: 'Upload to Drive',
      variant: 'primary',
      details: [fileName],
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          const uploaded = await uploadAudioToDrive(accessToken, track.fileBlob!, fileName);
          const updated: Track = {
            ...track,
            driveFileId: uploaded.id,
            source: 'drive',
          };
          await saveLocalTrackToDB(updated);
          onTrackAddedOrUpdated(updated);
          setStatusMessage(`Uploaded "${track.title}" to Google Drive!`);
          await loadDriveFiles(accessToken);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Drive upload failed.');
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  };

  const handleDeleteDriveFileWithConfirm = (item: DriveMediaItem) => {
    if (!accessToken) return;
    onRequestConfirm({
      title: 'Delete File from Google Drive?',
      description: `Permanently delete "${item.name}" from your Google Drive?`,
      confirmLabel: 'Delete from Drive',
      variant: 'danger',
      details: [item.name],
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await deleteDriveFile(accessToken, item.id);
          setDriveFiles((prev) => prev.filter((f) => f.id !== item.id));
          setStatusMessage(`Deleted "${item.name}" from Google Drive.`);
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Drive deletion failed.');
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  };

  const handleSaveCloudBackup = () => {
    if (!accessToken) return;
    const backup: PrimeOneCloudBackup = {
      version: 1,
      exportedAt: Date.now(),
      tracks: tracks.map(({ fileBlob: _fb, ...rest }) => rest),
      playlists,
      eqSettings,
      landscapeConfig,
      playerSettings,
    };

    onRequestConfirm({
      title: 'Save Backup to Google Drive?',
      description:
        'This will create or overwrite "prime-one-cloud-backup.json" inside your "Prime One Music" Google Drive folder with all playlists, edited tags, EQ curves, and themes.',
      confirmLabel: 'Save Backup',
      variant: 'primary',
      details: [`${tracks.length} tracks metadata`, `${playlists.length} playlists`, 'Themes & EQ presets'],
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await saveBackupToDrive(accessToken, backup);
          setStatusMessage('Full Prime One backup saved to Google Drive!');
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : 'Backup save failed.');
        } finally {
          setConfirmBusy(false);
        }
      },
    });
  };

  const handleRestoreCloudBackup = async () => {
    if (!accessToken) return;
    triggerHaptic(15);
    setErrorMsg(null);
    setStatusMessage('Searching for Prime One backup in Google Drive...');
    try {
      const backup = await restoreBackupFromDrive(accessToken);
      if (!backup) {
        setStatusMessage('No "prime-one-cloud-backup.json" file found in Google Drive yet.');
        return;
      }
      onRestoreBackupData(backup);
      setStatusMessage(
        `Restored backup from ${new Date(backup.exportedAt).toLocaleString()}!`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0d1424]/98 border border-cyan-500/30 p-5 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Prime One Cloud & Drive</h2>
              <p className="text-[11px] text-slate-400">
                Cross-device audio storage, Google Photos & tag sync
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Account Auth Bar */}
        <div className="mt-3">
          <GoogleAccountBanner
            user={user}
            accessToken={accessToken}
            needsWorkspaceReauth={needsWorkspaceReauth}
            onSignedIn={(u, tok) => {
              onGoogleSignedIn(u, tok);
              loadDriveFiles(tok);
            }}
            onSignedOut={onGoogleSignedOut}
            onError={setErrorMsg}
          />
        </div>

        {statusMessage && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Inner Tabs */}
        <div className="mt-3 flex items-center gap-1 p-1 bg-black/40 rounded-2xl border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('drive')}
            className={`flex-1 py-1.5 rounded-xl transition ${
              tab === 'drive' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Drive Audio ({driveFiles.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`flex-1 py-1.5 rounded-xl transition ${
              tab === 'upload' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Upload ({localUploadCandidates.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('sync')}
            className={`flex-1 py-1.5 rounded-xl transition ${
              tab === 'sync' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            Backup & Sync
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
          {tab === 'drive' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!accessToken}
                  onClick={handlePickFromDrive}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <FolderSearch className="w-4 h-4" />
                  <span>Browse Google Drive Picker</span>
                </button>
                <button
                  type="button"
                  disabled={!accessToken || loadingDrive}
                  onClick={() => accessToken && loadDriveFiles(accessToken)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 disabled:opacity-40"
                  title="Refresh Drive Audio"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingDrive ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {!accessToken ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white/5 rounded-2xl border border-white/5">
                  Sign in with Google above to browse and stream your audio files stored on Google Drive.
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white/5 rounded-2xl border border-white/5">
                  {loadingDrive
                    ? 'Scanning Google Drive for audio files...'
                    : 'No audio files found yet. Use "Browse Google Drive Picker" or upload tracks in the Upload tab.'}
                </div>
              ) : (
                driveFiles.map((file) => {
                  const cached = tracks.some((t) => t.driveFileId === file.id && t.fileBlob);
                  const mb = file.size ? (Number(file.size) / (1024 * 1024)).toFixed(1) : '?';
                  return (
                    <div
                      key={file.id}
                      className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 flex-shrink-0">
                          <FileAudio className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{file.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{mb} MB</span>
                            {cached && (
                              <span className="text-emerald-400 font-semibold">• Cached Offline</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleImportDriveItem(file, true)}
                          className="p-2 rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 transition"
                          title="Download & Play"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleImportDriveItem(file, false)}
                          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition"
                          title="Cache Offline"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDriveFileWithConfirm(file)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition"
                          title="Delete from Google Drive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === 'upload' && (
            <>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>
                  Local tracks uploaded here go into your &ldquo;Prime One Music&rdquo; Google Drive folder for instant playback on other Android devices.
                </span>
              </div>

              {!accessToken ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white/5 rounded-2xl">
                  Connect Google Drive above before uploading local audio files.
                </div>
              ) : localUploadCandidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white/5 rounded-2xl">
                  All imported local tracks are already backed up to Drive, or no local files are imported yet.
                </div>
              ) : (
                localUploadCandidates.map((tr) => (
                  <div
                    key={tr.id}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white truncate">{tr.title}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {tr.artist} • {tr.fileSize ? `${(tr.fileSize / 1048576).toFixed(1)} MB` : 'Local'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUploadTrackWithConfirmation(tr)}
                      className="px-3 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs flex items-center gap-1.5 flex-shrink-0"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload</span>
                    </button>
                  </div>
                ))
              )}
            </>
          )}

          {tab === 'sync' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Real-Time Cloud Profile Sync</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {user
                    ? `Signed in as ${user.email}. Edited song tags, favorites, playlists, EQ curves, and universe theme preferences automatically sync across your devices.`
                    : 'Sign in with Google to enable real-time cross-device sync for playlists, edited tags, and themes.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={!accessToken}
                  onClick={handleSaveCloudBackup}
                  className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-left space-y-1 disabled:opacity-40"
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-cyan-400" />
                    <span>Backup JSON to Drive</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Snapshot library tags, playlists, and EQ into Google Drive
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!accessToken}
                  onClick={handleRestoreCloudBackup}
                  className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-left space-y-1 disabled:opacity-40"
                >
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <DownloadCloud className="w-4 h-4 text-violet-400" />
                    <span>Restore from Drive</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Load your last Drive backup snapshot onto this device
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white min-h-[44px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
