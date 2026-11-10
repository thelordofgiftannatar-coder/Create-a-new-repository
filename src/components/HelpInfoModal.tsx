import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  Palette,
  Folder,
  Tag,
  Cloud,
  Smartphone,
  FolderArchive,
  Loader2,
  FileText,
  FileCode2,
} from 'lucide-react';
import {
  downloadGitHubAppZip,
  downloadStandaloneHtml,
  downloadWorkflowYaml,
} from '../services/githubExport';
import { triggerHaptic } from '../services/audioEngine';

interface HelpInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpInfoModal: React.FC<HelpInfoModalProps> = ({ isOpen, onClose }) => {
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingHtml, setDownloadingHtml] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportZip = async () => {
    triggerHaptic(15);
    setZipError(null);
    setDownloadingZip(true);
    try {
      await downloadGitHubAppZip();
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to create ZIP archive.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleExportHtml = async () => {
    triggerHaptic(15);
    setZipError(null);
    setDownloadingHtml(true);
    try {
      await downloadStandaloneHtml();
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to export standalone HTML.');
    } finally {
      setDownloadingHtml(false);
    }
  };

  const handleExportWorkflow = async () => {
    triggerHaptic(15);
    setZipError(null);
    try {
      await downloadWorkflowYaml();
    } catch (err) {
      setZipError(err instanceof Error ? err.message : 'Failed to download workflow YAML.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#0d1424] border border-white/15 p-5 shadow-2xl text-slate-100 max-h-[88vh] flex flex-col">
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Help &amp; Info — Prime One</h2>
              <p className="text-[11px] text-slate-400">Version 2.0 Android &amp; Cloud Hi-Fi Player</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close help"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-3 text-xs text-slate-300 pr-1">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex gap-3">
            <Folder className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Folder Browser &amp; Playlists</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Use &ldquo;Scan Music Folder&rdquo; to preserve your exact Android folder tree, browse Smart Categories (All songs, Favorites, Recently added/played, Most played, Not played), and open Album grids with 12 sort modes.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex gap-3">
            <Tag className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Tag Editor &amp; Google Photos Art</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Edit song title, artist, album, year, lyrics, and assign cover art directly from Google Photos, local device photos, or embedded ID3 metadata.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex gap-3">
            <Cloud className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Google Drive Storage &amp; Cross-Device Sync</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sign in with Google to upload audio files to your &ldquo;Prime One Music&rdquo; Drive folder, stream songs anywhere, and sync edited tags, playlists, and DIY preferences across devices.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex gap-3">
            <Palette className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">◐ AI &gt;4K Themes &amp; DIY Studio</div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Every built-in universe &amp; cover is mastered above 4K. Generate custom named themes up to 5K inside the AI &gt;4K tab and save them to your Themes Collection, then customize Icons, Widget Appearance, Screen Style, Colors, and Visual Effects live in DIY Style.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div className="flex gap-3">
              <Smartphone className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">GitHub APK Workflow &amp; Standalone HTML</div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  The GitHub ZIP is streamlined to <strong className="text-white">90 files</strong> (under GitHub&apos;s 100-file web upload limit) with <code className="text-cyan-300">.github/workflows/build-android-apk.yml</code> and your custom knight app cover icons. Unzip, select inside the folder, and drag directly into GitHub Upload!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportZip}
              disabled={downloadingZip}
              className="w-full py-2.5 px-3 rounded-xl bg-violet-500/25 hover:bg-violet-500/35 border border-violet-400/40 text-violet-100 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-60 min-h-[42px]"
            >
              {downloadingZip ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderArchive className="w-4 h-4 text-violet-300" />
              )}
              <span>
                {downloadingZip ? 'Packaging Prime One ZIP...' : 'Download GitHub Repo (.zip)'}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportHtml}
                disabled={downloadingHtml}
                className="py-2 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-100 font-bold text-[11px] flex items-center justify-center gap-1.5 transition disabled:opacity-60 min-h-[40px]"
              >
                {downloadingHtml ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-emerald-300" />
                )}
                <span>Standalone HTML</span>
              </button>

              <button
                type="button"
                onClick={handleExportWorkflow}
                className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition min-h-[40px]"
              >
                <FileCode2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>Workflow (.yml)</span>
              </button>
            </div>

            {zipError && <p className="text-[11px] text-red-300">{zipError}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-xs font-bold text-white min-h-[44px]"
        >
          Close
        </button>
      </div>
    </div>
  );
};
