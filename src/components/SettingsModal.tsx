import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Globe,
  Palette,
  Volume2,
  Tag,
  Headphones,
  Bell,
  LayoutGrid,
  Lock,
  Settings as SettingsIcon,
  History,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Upload,
  Download,
  Copy,
  Check,
  Cloud,
  Play,
  FolderArchive,
  Loader2,
  FileCode2,
  FileText,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  PrimeOneSettings,
  Track,
  Playlist,
  EqualizerSettings,
} from '../types/music';
import {
  DEFAULT_DIY_STYLE,
  LANDSCAPE_THEMES,
  LandscapeThemeConfig,
} from '../types/themeLandscape';
import {
  PermissionSummary,
  getPermissionSummary,
  requestNotificationPermission,
  requestPersistentAudioStorage,
  updateBackgroundMediaNotification,
} from '../services/permissionsService';
import {
  downloadGitHubAppZip,
  downloadStandaloneHtml,
  downloadWorkflowYaml,
  fetchWorkflowYaml,
} from '../services/githubExport';
import { triggerHaptic } from '../services/audioEngine';
import { GoogleAccountBanner } from './GoogleSignInButton';
import { PredictiveBackContainer, PredictiveBackHandle } from './PredictiveBackContainer';
import { FastScroller } from './FastScroller';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrimeOneSettings;
  onUpdateSettings: (next: PrimeOneSettings) => void;
  landscapeConfig: LandscapeThemeConfig;
  onUpdateLandscape: (next: LandscapeThemeConfig) => void;
  onOpenThemesModal: () => void;
  onOpenEQModal: () => void;
  onOpenImporterModal: () => void;
  onOpenCloudDriveModal: () => void;
  onOpenLockScreen: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  user: User | null;
  accessToken: string | null;
  needsWorkspaceReauth: boolean;
  onGoogleSignedIn: (user: User, token: string) => void;
  onGoogleSignedOut: () => void;
  tracks: Track[];
  playlists: Playlist[];
  eqSettings: EqualizerSettings;
  onImportJsonBackup: (json: unknown) => void;
  accentHex?: string;
}

type CategoryId =
  | 'language'
  | 'interface'
  | 'audio'
  | 'library'
  | 'headset'
  | 'notifications'
  | 'widgets'
  | 'lockscreen'
  | 'advanced'
  | 'backup';

const ANDROID_MANIFEST_SNIPPET = `<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />`;

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  landscapeConfig,
  onUpdateLandscape,
  onOpenThemesModal,
  onOpenEQModal,
  onOpenImporterModal,
  onOpenCloudDriveModal,
  onOpenLockScreen,
  currentTrack,
  isPlaying,
  user,
  accessToken,
  needsWorkspaceReauth,
  onGoogleSignedIn,
  onGoogleSignedOut,
  tracks,
  playlists,
  eqSettings,
  onImportJsonBackup,
  accentHex = '#38bdf8',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [perms, setPerms] = useState<PermissionSummary>({
    notifications: 'prompt',
    persistentStorage: 'prompt',
    wakeLock: 'granted',
    mediaSession: 'granted',
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingHtml, setIsExportingHtml] = useState(false);
  const importBackupRef = useRef<HTMLInputElement | null>(null);
  const modalBackRef = useRef<PredictiveBackHandle | null>(null);
  const subBackRef = useRef<PredictiveBackHandle | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      getPermissionSummary().then(setPerms);
    } else {
      setSelectedCategory(null);
      setShowSearch(false);
      setSearchQuery('');
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSetting = (key: keyof PrimeOneSettings) => {
    triggerHaptic(15);
    onUpdateSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const handleRequestNotifications = async () => {
    triggerHaptic(15);
    const res = await requestNotificationPermission();
    setPerms((p) => ({ ...p, notifications: res }));
    if (res === 'granted') {
      setFeedback('Background playback notifications enabled!');
      await updateBackgroundMediaNotification(currentTrack, isPlaying, true);
    } else if (res === 'denied') {
      setFeedback('Notifications blocked by browser. Allow them in Android / site settings.');
    } else {
      setFeedback('System Notification API unavailable in this embedded preview; active in installed PWA & Android APK.');
    }
  };

  const handleRequestStorage = async () => {
    triggerHaptic(15);
    const granted = await requestPersistentAudioStorage();
    const fresh = await getPermissionSummary();
    setPerms(fresh);
    setFeedback(
      granted
        ? 'Persistent Audio & Media storage granted! Browser will not evict offline songs.'
        : 'Storage permission updated.'
    );
  };

  const handleExportLocalJson = () => {
    triggerHaptic(15);
    const payload = {
      app: 'Prime One',
      version: 1,
      exportedAt: Date.now(),
      tracks: tracks.map(({ fileBlob: _fb, ...rest }) => rest),
      playlists,
      eqSettings,
      landscapeConfig,
      playerSettings: settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prime-one-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setFeedback('Exported Prime One backup JSON.');
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        onImportJsonBackup(parsed);
        setFeedback('Restored settings, playlists & tags from backup JSON!');
      } catch {
        setFeedback('Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleExportGitHubZip = async () => {
    triggerHaptic(15);
    if (isExportingZip) return;
    setIsExportingZip(true);
    setFeedback(null);
    try {
      await downloadGitHubAppZip();
      setFeedback('Downloaded Prime-One-GitHub-App.zip — push to GitHub to run Android APK compilation via GitHub Actions.');
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Unable to generate GitHub repository ZIP.'
      );
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleExportStandaloneHtml = async () => {
    triggerHaptic(15);
    if (isExportingHtml) return;
    setIsExportingHtml(true);
    setFeedback(null);
    try {
      await downloadStandaloneHtml();
      setFeedback('Exported self-contained Prime-One-Player.html!');
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Unable to export standalone HTML bundle.'
      );
    } finally {
      setIsExportingHtml(false);
    }
  };

  const handleCopyWorkflowYaml = async () => {
    triggerHaptic(15);
    setFeedback(null);
    try {
      const yaml = await fetchWorkflowYaml();
      await navigator.clipboard.writeText(yaml);
      setCopiedWorkflow(true);
      setFeedback('Copied .github/workflows/build-android-apk.yml to clipboard — paste it into GitHub Actions.');
      setTimeout(() => setCopiedWorkflow(false), 3000);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to copy workflow YAML.');
    }
  };

  const handleDownloadWorkflowYaml = async () => {
    triggerHaptic(15);
    setFeedback(null);
    try {
      await downloadWorkflowYaml();
      setFeedback('Downloaded build-android-apk.yml — commit inside .github/workflows/ in your GitHub repo.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to download workflow YAML.');
    }
  };

  const CATEGORIES: {
    id: CategoryId;
    title: string;
    subtitle: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'language', title: 'Language', subtitle: `Active: ${settings.language.toUpperCase()}`, icon: Globe },
    { id: 'interface', title: 'Interface', subtitle: 'Thematic landscapes (◐), Song Art, waveforms, album grid', icon: Palette },
    { id: 'audio', title: 'Audio', subtitle: 'Equalizer, playback speed, gapless transition', icon: Volume2 },
    { id: 'library', title: 'Song library and tags', subtitle: 'Auto ID3 cover extraction, scan folders, curated tracks', icon: Tag },
    { id: 'headset', title: 'Headset, Bluetooth and speakers', subtitle: 'Auto-pause on disconnect & output routing', icon: Headphones },
    { id: 'notifications', title: 'Notifications', subtitle: `Status: ${perms.notifications} • Background lock-screen controls`, icon: Bell },
    { id: 'widgets', title: 'HomeScreen widgets', subtitle: 'Android PWA & home-screen widget preview', icon: LayoutGrid },
    { id: 'lockscreen', title: 'Prime One lock-screen', subtitle: 'Full-screen cover lock overlay & Keep Screen Awake', icon: Lock },
    { id: 'advanced', title: 'Advanced', subtitle: 'Android permissions (Audio, Photos/Videos, Notifications) & GitHub APK', icon: SettingsIcon },
    { id: 'backup', title: 'Backup/Restore', subtitle: 'Google Account Cloud Sync, Google Drive & JSON export', icon: History },
  ];

  const filteredCategories = searchQuery.trim()
    ? CATEGORIES.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : CATEGORIES;

  const activeMeta = CATEGORIES.find((c) => c.id === selectedCategory);

  const rootCategoriesView = (
    <div className="divide-y divide-white/[0.04] py-2">
      {filteredCategories.map((cat) => {
        const Icon = cat.icon;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setSelectedCategory(cat.id);
            }}
            className="w-full px-5 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.04] active:bg-white/[0.08] transition text-left min-h-[60px]"
          >
            <div className="flex items-center gap-5 min-w-0">
              <Icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-slate-100">{cat.title}</div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{cat.subtitle}</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );

  const renderCategoryDetail = () => (
    <div className="p-4 space-y-3">
            {selectedCategory === 'language' && (
              <div className="space-y-2">
                {(
                  [
                    { id: 'en', name: 'English (Prime One Default)' },
                    { id: 'es', name: 'Español (Spanish)' },
                    { id: 'pt', name: 'Português (Portuguese)' },
                    { id: 'ja', name: '日本語 (Japanese)' },
                  ] as const
                ).map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic(15);
                      onUpdateSettings({ ...settings, language: lang.id });
                    }}
                    className={`w-full p-4 rounded-2xl border flex items-center justify-between text-left ${
                      settings.language === lang.id
                        ? 'bg-violet-500/20 border-violet-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300'
                    }`}
                  >
                    <span className="text-sm font-medium">{lang.name}</span>
                    {settings.language === lang.id && (
                      <CheckCircle2 className="w-5 h-5 text-violet-400" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedCategory === 'interface' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenThemesModal();
                  }}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-500/15 to-violet-500/15 border border-cyan-400/30 flex items-center justify-between text-left"
                >
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>◐ Thematic Landscapes & DIY Wallpapers</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Pick from {LANDSCAPE_THEMES.length} universe landscapes or upload custom art/videos
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-cyan-300" />
                </button>

                <SettingToggleRow
                  label="Song Original Art Background"
                  description="Use the current playing song artwork as full-screen wallpaper"
                  checked={landscapeConfig.useAlbumArtFallback}
                  onToggle={() =>
                    onUpdateLandscape({
                      ...landscapeConfig,
                      useAlbumArtFallback: !landscapeConfig.useAlbumArtFallback,
                    })
                  }
                />

                <SettingToggleRow
                  label="Static Audio Density Waveforms"
                  description="Display audio density waveform preview inside track rows"
                  checked={settings.showWaveforms}
                  onToggle={() => toggleSetting('showWaveforms')}
                />

                <SettingToggleRow
                  label="Dense 5-Column Album Grid"
                  description="Show extra compact columns in the Albums artwork grid"
                  checked={settings.compactAlbumGrid}
                  onToggle={() => toggleSetting('compactAlbumGrid')}
                />
              </div>
            )}

            {selectedCategory === 'audio' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEQModal();
                  }}
                  className="w-full p-4 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-between text-left"
                >
                  <div>
                    <div className="text-sm font-bold text-white">5-Band Equalizer & Bass Boost</div>
                    <div className="text-xs text-slate-400">
                      Preset: {eqSettings.preset.toUpperCase()} • {eqSettings.enabled ? 'Active' : 'Bypassed'}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-cyan-300" />
                </button>

                <SettingToggleRow
                  label="Gapless Transition Mode"
                  description="Minimize gaps between consecutive tracks in your queue"
                  checked={settings.gaplessPlayback}
                  onToggle={() => toggleSetting('gaplessPlayback')}
                />

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span>Default Playback Speed</span>
                    <span className="text-cyan-300 font-mono">{settings.defaultPlaybackRate}x</span>
                  </div>
                  <div className="flex gap-2">
                    {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => onUpdateSettings({ ...settings, defaultPlaybackRate: rate })}
                        className={`flex-1 py-2 rounded-xl text-xs font-mono border ${
                          settings.defaultPlaybackRate === rate
                            ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                            : 'bg-white/5 border-white/10 text-slate-300'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedCategory === 'library' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenImporterModal();
                  }}
                  className="w-full p-4 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-between text-left"
                >
                  <div>
                    <div className="text-sm font-bold text-white">Scan Device Folders & Audio Files</div>
                    <div className="text-xs text-slate-400">Import MP3, FLAC, WAV, M4A & preserve folders</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <SettingToggleRow
                  label="Auto-Extract Embedded ID3 Artwork"
                  description="Parse MP3/FLAC album cover art when scanning files"
                  checked={settings.autoExtractArt}
                  onToggle={() => toggleSetting('autoExtractArt')}
                />

                <SettingToggleRow
                  label="Include Built-In Demo Soundtracks"
                  description="Show curated soundscapes alongside your personal Android library"
                  checked={settings.showCuratedTracks}
                  onToggle={() => toggleSetting('showCuratedTracks')}
                />
              </div>
            )}

            {selectedCategory === 'headset' && (
              <div className="space-y-3">
                <SettingToggleRow
                  label="Auto-Pause on Headset / Bluetooth Disconnect"
                  description="Automatically pause playback if headphones or speaker output unplugs"
                  checked={settings.headsetAutoPause}
                  onToggle={() => toggleSetting('headsetAutoPause')}
                />
                <SettingToggleRow
                  label="Bluetooth Media Button Control"
                  description="Enable AVRCP play/pause/next/prev controls via Android MediaSession"
                  checked={true}
                  onToggle={() => setFeedback('Hardware media keys are always active via MediaSession API.')}
                />
              </div>
            )}

            {selectedCategory === 'notifications' && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white">Notification Permission</div>
                      <div className="text-xs text-slate-400">
                        Required for persistent background playback controls on Android
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                        perms.notifications === 'granted'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : perms.notifications === 'denied'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {perms.notifications}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRequestNotifications}
                      className="px-3.5 py-2 rounded-xl bg-cyan-500 text-black text-xs font-bold"
                    >
                      Request Notification Access
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateBackgroundMediaNotification(
                          currentTrack,
                          isPlaying,
                          settings.enableNotifications
                        )
                      }
                      className="px-3.5 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Test Now-Playing Notification</span>
                    </button>
                  </div>
                </div>

                <SettingToggleRow
                  label="Background Playback Notification"
                  description="Keep Prime One playback notification active when minimized"
                  checked={settings.enableNotifications}
                  onToggle={() => toggleSetting('enableNotifications')}
                />

                <SettingToggleRow
                  label="Sticky Player Controls"
                  description="Show Previous / Play-Pause / Next buttons inside Android shade"
                  checked={settings.stickyNotification}
                  onToggle={() => toggleSetting('stickyNotification')}
                />
              </div>
            )}

            {selectedCategory === 'widgets' && (() => {
              const diy = { ...DEFAULT_DIY_STYLE, ...(landscapeConfig.diyStyle || {}) };
              const widgetColor = diy.customPrimaryHex || accentHex;
              const widgetArtClass =
                diy.widgetArtShape === 'circle' || diy.widgetStyle === 'vinyl-dock'
                  ? 'rounded-full'
                  : diy.widgetArtShape === 'square'
                  ? 'rounded-md'
                  : 'rounded-xl';
              const widgetRadiusClass =
                diy.widgetStyle === 'floating-pill' ? 'rounded-full px-4' : 'rounded-2xl px-3';

              return (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-black border border-white/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: widgetColor }}>
                        Prime One 4×1 Widget Live Preview
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {diy.widgetStyle} · {Math.round(diy.widgetOpacity * 100)}%
                      </span>
                    </div>

                    <div
                      style={{
                        backgroundColor: diy.customSurfaceHex || '#161b29',
                        opacity: diy.widgetOpacity,
                        borderColor:
                          diy.widgetStyle === 'glass-card' || diy.screenStyle === 'neon-hud'
                            ? `${widgetColor}66`
                            : 'rgba(255,255,255,0.14)',
                      }}
                      className={`relative py-3 border ${widgetRadiusClass} flex items-center justify-between gap-3 shadow-xl overflow-hidden`}
                    >
                      {diy.widgetShowProgress && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-black/40">
                          <div className="h-full w-2/3" style={{ backgroundColor: widgetColor }} />
                        </div>
                      )}
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={currentTrack?.coverUrl || '/pwa-512x512.png'}
                          alt="Widget Art"
                          className={`w-11 h-11 ${widgetArtClass} object-cover ${
                            diy.widgetStyle === 'vinyl-dock' && isPlaying ? 'animate-spin-slow' : ''
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {currentTrack?.title || 'Ready to Play'}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {currentTrack?.artist || 'Prime One'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold" style={{ color: widgetColor }}>
                        {diy.widgetShowFavorite && <span>♥</span>}
                        <span>⏮</span>
                        <span>{isPlaying ? '❚❚' : '▶'}</span>
                        <span>⏭</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenThemesModal();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white transition"
                    >
                      Customize Widget, Icons &amp; Colors in DIY Studio
                    </button>

                    <p className="text-[11px] text-slate-400">
                      Live reflects your DIY Studio settings. Push the ZIP to GitHub to compile an Android APK with persistent notification &amp; lock-screen media widgets.
                    </p>
                  </div>
                </div>
              );
            })()}

            {selectedCategory === 'lockscreen' && (
              <div className="space-y-3">
                <SettingToggleRow
                  label="Prime One Lock-Screen Player"
                  description="Full-screen lock-screen style artwork & waveform playback view"
                  checked={settings.enableLockScreenOverlay}
                  onToggle={() => toggleSetting('enableLockScreenOverlay')}
                />

                <SettingToggleRow
                  label="Keep Screen Awake While Listening"
                  description="Use Screen Wake Lock API during full-player or lock-screen view"
                  checked={settings.keepScreenAwake}
                  onToggle={() => toggleSetting('keepScreenAwake')}
                />

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLockScreen();
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-bold text-xs shadow-lg"
                >
                  Open Prime One Lock-Screen Now
                </button>
              </div>
            )}

            {selectedCategory === 'advanced' && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/15 space-y-3">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>Android & App Permissions Center</span>
                  </div>

                  {/* Permission rows requested by user */}
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">Music & Audios (Storage)</div>
                        <div className="text-[10px] text-slate-400">
                          READ_MEDIA_AUDIO • Offline IndexedDB Persistence
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestStorage}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                          perms.persistentStorage === 'granted'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-cyan-500 text-black'
                        }`}
                      >
                        {perms.persistentStorage === 'granted' ? 'Granted' : 'Grant Storage'}
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">Photos & Videos (Art & Wallpapers)</div>
                        <div className="text-[10px] text-slate-400">
                          READ_MEDIA_IMAGES / VIDEO + Google Photos API
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          accessToken
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {accessToken ? 'Google Connected' : 'Local Ready'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-white">Notifications & Background Playback</div>
                        <div className="text-[10px] text-slate-400">
                          POST_NOTIFICATIONS • FOREGROUND_SERVICE_MEDIA_PLAYBACK
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestNotifications}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                          perms.notifications === 'granted'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-cyan-500 text-black'
                        }`}
                      >
                        {perms.notifications === 'granted' ? 'Granted' : 'Allow Alerts'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* GitHub -> Android APK + Standalone HTML Packaging */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/15 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-violet-400" />
                      <span>GitHub APK Workflow &amp; HTML Export</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(ANDROID_MANIFEST_SNIPPET);
                        setCopiedManifest(true);
                        setTimeout(() => setCopiedManifest(false), 2500);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1"
                    >
                      {copiedManifest ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedManifest ? 'Copied' : 'Copy Permissions'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Packaged at <strong className="text-white">90 files</strong> (under GitHub&apos;s 100-file web upload limit). Unzip it, open inside the folder, select all (with hidden <code className="text-cyan-300">.github</code> enabled), and drag straight into GitHub <strong className="text-white">Upload files</strong> — then run <strong className="text-white">Actions → Build Prime One Android APK</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportGitHubZip}
                    disabled={isExportingZip}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition disabled:opacity-60 min-h-[44px]"
                  >
                    {isExportingZip ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FolderArchive className="w-4 h-4" />
                    )}
                    <span>
                      {isExportingZip
                        ? 'Packaging Prime-One-GitHub-App.zip...'
                        : 'Download GitHub Repo (.zip)'}
                    </span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopyWorkflowYaml}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5 min-h-[42px]"
                    >
                      {copiedWorkflow ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileCode2 className="w-3.5 h-3.5 text-cyan-300" />}
                      <span>{copiedWorkflow ? 'Copied Workflow YAML' : 'Copy Workflow (.yml)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadWorkflowYaml}
                      className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5 min-h-[42px]"
                    >
                      <Download className="w-3.5 h-3.5 text-violet-300" />
                      <span>Download Workflow (.yml)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportStandaloneHtml}
                    disabled={isExportingHtml}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/35 text-emerald-100 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-60 min-h-[44px]"
                  >
                    {isExportingHtml ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 text-emerald-300" />
                    )}
                    <span>
                      {isExportingHtml
                        ? 'Bundling Prime-One-Player.html...'
                        : 'Export Single-File HTML (Prime-One-Player.html)'}
                    </span>
                  </button>

                  <pre className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-[10px] font-mono text-slate-300 overflow-x-auto">
                    {ANDROID_MANIFEST_SNIPPET}
                  </pre>
                </div>
              </div>
            )}

            {selectedCategory === 'backup' && (
              <div className="space-y-3">
                <GoogleAccountBanner
                  user={user}
                  accessToken={accessToken}
                  needsWorkspaceReauth={needsWorkspaceReauth}
                  onSignedIn={onGoogleSignedIn}
                  onSignedOut={onGoogleSignedOut}
                  onError={setFeedback}
                />

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenCloudDriveModal();
                  }}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-400/40 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-sm font-bold text-white">Open Google Drive Music & Cloud Backup</div>
                      <div className="text-xs text-slate-300">
                        Upload songs to Google Drive, stream on any device, save/restore cloud snapshot
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-cyan-300" />
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportLocalJson}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left space-y-1"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    <div className="text-xs font-bold text-white">Export JSON File</div>
                    <div className="text-[10px] text-slate-400">Save local backup to Downloads</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => importBackupRef.current?.click()}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left space-y-1"
                  >
                    <Upload className="w-4 h-4 text-violet-400" />
                    <div className="text-xs font-bold text-white">Import JSON File</div>
                    <div className="text-[10px] text-slate-400">Restore from saved backup file</div>
                  </button>
                  <input
                    ref={importBackupRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={handleImportJsonFile}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportGitHubZip}
                  disabled={isExportingZip}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-violet-500/20 to-cyan-500/15 hover:from-violet-500/30 hover:to-cyan-500/25 border border-violet-400/35 flex items-center justify-between text-left transition disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    {isExportingZip ? (
                      <Loader2 className="w-5 h-5 text-violet-300 animate-spin" />
                    ) : (
                      <FolderArchive className="w-5 h-5 text-violet-300" />
                    )}
                    <div>
                      <div className="text-sm font-bold text-white">
                        {isExportingZip
                          ? 'Packaging GitHub Repo (.zip)...'
                          : 'GitHub APK Project (.zip)'}
                      </div>
                      <div className="text-xs text-slate-300">
                        90 files (&lt;100 GitHub web limit) · APK workflow &amp; custom cover icons
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-violet-300 flex-shrink-0" />
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportStandaloneHtml}
                    disabled={isExportingHtml}
                    className="p-3.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-left space-y-1 transition disabled:opacity-60"
                  >
                    <FileText className="w-4 h-4 text-emerald-300" />
                    <div className="text-xs font-bold text-white">
                      {isExportingHtml ? 'Bundling...' : 'Standalone HTML'}
                    </div>
                    <div className="text-[10px] text-slate-300">Single Prime-One-Player.html file</div>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadWorkflowYaml}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left space-y-1"
                  >
                    <FileCode2 className="w-4 h-4 text-cyan-300" />
                    <div className="text-xs font-bold text-white">GitHub Workflow</div>
                    <div className="text-[10px] text-slate-400">build-android-apk.yml</div>
                  </button>
                </div>
              </div>
            )}
    </div>
  );

  const settingsShell = (
    <div className="w-full h-full bg-[#121318] text-slate-100 flex flex-col pt-safe pb-safe overflow-hidden">
      {/* Top App Bar: ← Settings 🔍 */}
      <header className="px-4 py-3.5 bg-[#1b1c23] border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              if (selectedCategory) {
                if (subBackRef.current) {
                  subBackRef.current.triggerBack();
                } else {
                  setSelectedCategory(null);
                }
              } else if (modalBackRef.current) {
                modalBackRef.current.triggerBack();
              } else {
                onClose();
              }
            }}
            className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {showSearch ? (
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings..."
              className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-violet-400"
            />
          ) : (
            <h1 className="text-lg font-semibold text-white truncate">
              {activeMeta ? activeMeta.title : 'Settings'}
            </h1>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic(10);
            if (selectedCategory) setSelectedCategory(null);
            setShowSearch((prev) => !prev);
            setSearchQuery('');
          }}
          className="p-2 rounded-full hover:bg-white/10 text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Search settings"
        >
          <Search className="w-5 h-5" />
        </button>
      </header>

      {feedback && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 text-xs flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-cyan-300 font-bold text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Body managed by inner PredictiveBackContainer */}
      <div ref={scrollBodyRef} className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto relative">
        <PredictiveBackContainer
          ref={subBackRef}
          canGoBack={Boolean(selectedCategory)}
          onBack={() => setSelectedCategory(null)}
          backgroundContent={rootCategoriesView}
          foregroundContent={selectedCategory ? renderCategoryDetail() : null}
        />
        {!selectedCategory && (
          <FastScroller
            items={filteredCategories}
            getLabel={(cat) => cat.title}
            scrollContainerRef={scrollBodyRef}
          />
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-transparent">
      <PredictiveBackContainer
        ref={modalBackRef}
        canGoBack={!selectedCategory}
        fullScreenModal={true}
        onBack={onClose}
        className="flex-1 flex flex-col h-full w-full"
        foregroundContent={settingsShell}
      />
    </div>
  );
};

interface SettingToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  label,
  description,
  checked,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/[0.08] border border-white/10 flex items-center justify-between gap-4 text-left min-h-[60px]"
  >
    <div className="min-w-0">
      <div className="text-sm font-semibold text-white">{label}</div>
      <div className="text-[11px] text-slate-400 mt-0.5">{description}</div>
    </div>
    <div
      className={`w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${
        checked ? 'bg-violet-500' : 'bg-slate-700'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </div>
  </button>
);
