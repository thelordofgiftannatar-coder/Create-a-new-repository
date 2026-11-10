import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  Check,
  X,
  Share2,
  PlusSquare,
  Copy,
  FolderArchive,
  FileText,
  Loader2,
  MoreVertical,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { triggerHaptic } from '../services/audioEngine';
import { downloadGitHubAppZip, downloadStandaloneHtml } from '../services/githubExport';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showPhoneInstallModal, setShowPhoneInstallModal] = useState(false);
  const [platformTab, setPlatformTab] = useState<'android' | 'ios'>(() => (isIOS ? 'ios' : 'android'));
  const [installedNotice, setInstalledNotice] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadingHtml, setDownloadingHtml] = useState(false);

  // When already running in standalone installed PWA mode, hide the install CTA cleanly
  if (isInstalled) {
    return null;
  }

  const handleOpenOrInstall = async () => {
    triggerHaptic(20);
    if (isInstallable) {
      const success = await install();
      if (success) {
        setInstalledNotice(true);
        setTimeout(() => setInstalledNotice(false), 4000);
        return;
      }
    }
    setPlatformTab(isIOS ? 'ios' : 'android');
    setShowPhoneInstallModal(true);
  };

  const handleCopyAppUrl = () => {
    triggerHaptic(12);
    const urlToCopy = window.location.origin + '/';
    navigator.clipboard.writeText(urlToCopy).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  const handleDownloadApkProject = async () => {
    triggerHaptic(15);
    setDownloadingZip(true);
    try {
      await downloadGitHubAppZip();
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDownloadHtml = async () => {
    triggerHaptic(15);
    setDownloadingHtml(true);
    try {
      await downloadStandaloneHtml();
    } finally {
      setDownloadingHtml(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenOrInstall}
        aria-label="Download App on Your Phone"
        className="prime-icon-btn flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-bold hover:border-cyan-300 active:scale-95 transition-all shadow-sm min-h-[36px]"
      >
        <img
          src="/pwa-192x192.png"
          alt="Prime One App Cover"
          className="w-5 h-5 rounded-md object-cover border border-white/25 flex-shrink-0"
        />
        <Smartphone className="w-3.5 h-3.5 text-cyan-300 hidden sm:inline" />
        <span>{isInstallable ? 'Install App' : 'Get App'}</span>
      </button>

      {installedNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-semibold">
          <Check className="w-4 h-4" />
          <span>Prime One installed with your App Cover!</span>
        </div>
      )}

      {showPhoneInstallModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#0d1424] border border-cyan-400/30 p-5 shadow-2xl text-slate-200 max-h-[90vh] flex flex-col">
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <img
                  src="/pwa-512x512.png"
                  alt="Prime One Icon"
                  className="w-10 h-10 rounded-xl object-cover border border-white/25 shadow-md"
                />
                <div>
                  <h3 className="text-base font-bold text-white">Download Prime One App</h3>
                  <p className="text-[11px] text-slate-400">
                    Installs directly on your phone with custom cover art
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneInstallModal(false)}
                className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close Install Guide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Phone Home Screen Icon & Splash Cover Preview */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-white/[0.07] to-black/50 border border-white/15 flex items-center gap-4">
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl ring-2 ring-cyan-400/40 bg-[#090d16]">
                    <img
                      src="/pwa-512x512.png"
                      alt="Home Screen App Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-white">Prime One</span>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-xs font-bold text-white">Phone App Cover Ready</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Your uploaded knight crest artwork is configured as the Home Screen icon, iOS Apple Touch icon, Android adaptive launcher icon, and APK splash cover.
                  </p>
                </div>

                <img
                  src="/app-cover.png"
                  alt="Splash Cover Preview"
                  className="w-12 h-16 rounded-xl object-cover border border-white/20 flex-shrink-0 hidden sm:block"
                />
              </div>

              {/* Native Browser Install Prompt Button (if ready) */}
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    triggerHaptic(20);
                    const ok = await install();
                    if (ok) {
                      setShowPhoneInstallModal(false);
                      setInstalledNotice(true);
                      setTimeout(() => setInstalledNotice(false), 4000);
                    }
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 min-h-[46px]"
                >
                  <Download className="w-4 h-4" />
                  <span>Install Prime One on This Device Now</span>
                </button>
              )}

              {/* Platform Switcher: Android vs iPhone */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/45 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setPlatformTab('android')}
                  className={`py-2 rounded-lg font-bold transition min-h-[38px] ${
                    platformTab === 'android'
                      ? 'bg-cyan-500 text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Android (Chrome)
                </button>
                <button
                  type="button"
                  onClick={() => setPlatformTab('ios')}
                  className={`py-2 rounded-lg font-bold transition min-h-[38px] ${
                    platformTab === 'ios'
                      ? 'bg-cyan-500 text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  iPhone / iPad (Safari)
                </button>
              </div>

              {platformTab === 'android' ? (
                <div className="space-y-2 leading-relaxed text-slate-300">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[11px]">
                      1
                    </span>
                    <p>
                      Open the app link below directly in <strong className="text-white">Google Chrome</strong> on your Android phone (outside preview frames).
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[11px]">
                      2
                    </span>
                    <p className="flex items-center flex-wrap gap-1">
                      Tap the <MoreVertical className="w-3.5 h-3.5 text-white inline" /> menu in the top-right corner and select <strong className="text-white">&ldquo;Install app&rdquo;</strong> or <strong className="text-white">&ldquo;Add to Home screen&rdquo;</strong>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[11px]">
                      3
                    </span>
                    <p>
                      Chrome installs <strong className="text-white">Prime One</strong> on your Home Screen with your custom artwork and full offline background audio playback.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 leading-relaxed text-slate-300">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[11px]">
                      1
                    </span>
                    <p>
                      Open Prime One in <strong className="text-white">Safari</strong> on your iPhone or iPad and tap the <Share2 className="w-3.5 h-3.5 text-cyan-300 inline mx-0.5" /> <strong className="text-white">Share</strong> button in the toolbar.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[11px]">
                      2
                    </span>
                    <p>
                      Scroll down and tap <PlusSquare className="w-3.5 h-3.5 text-cyan-300 inline mx-0.5" /> <strong className="text-white">&ldquo;Add to Home Screen&rdquo;</strong>, then tap <strong className="text-white">Add</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* Copy Direct App Link & Export Downloads */}
              <button
                type="button"
                onClick={handleCopyAppUrl}
                className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-bold text-xs text-white flex items-center justify-center gap-2 min-h-[42px]"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-300" />}
                <span>{copiedUrl ? 'App Link Copied — Paste in Phone Browser' : 'Copy Phone App URL'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadApkProject}
                  disabled={downloadingZip}
                  className="py-2.5 px-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/35 text-violet-100 font-bold text-[11px] flex items-center justify-center gap-1.5 min-h-[42px] disabled:opacity-60"
                >
                  {downloadingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderArchive className="w-3.5 h-3.5 text-violet-300" />}
                  <span>{downloadingZip ? 'Zipping...' : 'GitHub APK (.zip)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  disabled={downloadingHtml}
                  className="py-2.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-100 font-bold text-[11px] flex items-center justify-center gap-1.5 min-h-[42px] disabled:opacity-60"
                >
                  {downloadingHtml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-emerald-300" />}
                  <span>{downloadingHtml ? 'Bundling...' : 'Offline HTML'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPhoneInstallModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-semibold text-xs text-white transition min-h-[42px]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
