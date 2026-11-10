import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  Eye,
  Film,
  Sparkles,
  Disc,
  Shield,
  Wand2,
  Download,
  BookmarkPlus,
  Trash2,
  Paintbrush,
  Palette,
  LayoutTemplate,
  Shapes,
  ChevronDown,
  ChevronUp,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import {
  CustomThemeRecord,
  DEFAULT_DIY_STYLE,
  DiyCardRadius,
  DiyHeroArtMode,
  DiyIconPack,
  DiyIconShape,
  DiyPlayerStyle,
  DiyScreenStyle,
  DiyWidgetArtShape,
  DiyWidgetStyle,
  LandscapeTheme,
  LANDSCAPE_THEMES,
  LandscapeThemeConfig,
  MASTER_CHATGPT_PROMPT,
  OverlayEffectType,
  ThemeCategory,
} from '../types/themeLandscape';
import {
  AI_ART_STYLES,
  AI_RESOLUTION_PRESETS,
  AiArtStyleId,
  AiResolutionPresetId,
  downloadDataUrl,
  generateAiThemeComposition,
  renderSceneToOver4KImage,
  SceneCompositionBlueprint,
} from '../services/aiThemeRenderer';
import { triggerHaptic } from '../services/audioEngine';

interface ThemeLandscapeModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: LandscapeThemeConfig;
  onUpdateConfig: (newConfig: LandscapeThemeConfig) => void;
  customThemes: CustomThemeRecord[];
  onSaveCustomTheme: (theme: CustomThemeRecord) => Promise<void> | void;
  onDeleteCustomTheme: (themeId: string) => Promise<void> | void;
  currentTrackCover?: string;
}

const QUICK_AI_PROMPTS = [
  {
    title: 'Neon Samurai Rain',
    badge: 'Neo-Tokyo 4K',
    style: 'cyberpunk-noir' as AiArtStyleId,
    prompt:
      'Rain-soaked cyberpunk megacity rooftop at midnight with cyan and magenta holographic billboards, a lone neon samurai looking over wet reflective towers.',
  },
  {
    title: 'Crimson Eclipse Ruins',
    badge: 'Dark Oath',
    style: 'dark-fantasy' as AiArtStyleId,
    prompt:
      'Ancient ruined gothic cathedral valley under a burning crimson solar eclipse, glowing ash embers rising past a lone knight with a greatsword.',
  },
  {
    title: 'Astral Rift Horizon',
    badge: 'Starlight Myth',
    style: 'cosmic-myth' as AiArtStyleId,
    prompt:
      'Celestial canyon split by a towering portal of blue aurora stars and golden storm clouds, volumetric god rays sweeping across reflective water.',
  },
  {
    title: 'Emerald Watchtower',
    badge: 'Sky Citadel',
    style: 'comic-splash' as AiArtStyleId,
    prompt:
      'Heavy comic-ink illustration of a cliffside emerald crystal fortress overlooking misty valleys at twilight with floating lanterns.',
  },
];

const OVERLAY_OPTIONS: { id: 'theme-default' | OverlayEffectType; label: string }[] = [
  { id: 'theme-default', label: 'Match Active Theme' },
  { id: 'aurora-waves', label: 'Aurora Waves' },
  { id: 'prism-rays', label: 'Prism Light Rays' },
  { id: 'scanlines', label: 'Cyber Scanlines' },
  { id: 'rain', label: 'Neon Rain' },
  { id: 'embers', label: 'Glowing Embers' },
  { id: 'stars', label: 'Cosmic Starfield' },
  { id: 'digital-rain', label: 'Digital Code Rain' },
  { id: 'fireflies', label: 'Forest Fireflies' },
  { id: 'candles', label: 'Floating Candles' },
  { id: 'portal', label: 'Energy Vortex' },
  { id: 'red-smoke', label: 'Crimson Smoke' },
  { id: 'snow', label: 'Nordic Snow' },
  { id: 'sandstorm', label: 'Arrakis Sandstorm' },
  { id: 'none', label: 'Clean Artwork (None)' },
];

const ACCENT_SWATCHES = ['#38bdf8', '#8b5cf6', '#f43f5e', '#f59e0b', '#10b981', '#eab308'];

export const ThemeLandscapeModal: React.FC<ThemeLandscapeModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  customThemes,
  onSaveCustomTheme,
  onDeleteCustomTheme,
}) => {
  const [activeTab, setActiveTab] = useState<'themes' | 'ai' | 'diy' | 'tuning'>('themes');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [copiedThemeId, setCopiedThemeId] = useState<string | null>(null);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI >4K Generator State
  const [aiName, setAiName] = useState('Cyber Valhalla');
  const [aiBadge, setAiBadge] = useState('AI 4K+ Original');
  const [aiPrompt, setAiPrompt] = useState(QUICK_AI_PROMPTS[0].prompt);
  const [aiStyle, setAiStyle] = useState<AiArtStyleId>('cyberpunk-noir');
  const [aiResolution, setAiResolution] = useState<AiResolutionPresetId>('portrait-4k');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStage, setGenStage] = useState('');
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedArt, setGeneratedArt] = useState<{
    dataUrl: string;
    width: number;
    height: number;
    approxKb: number;
    blueprint: SceneCompositionBlueprint;
    sourceNote: string;
  } | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const allThemes: LandscapeTheme[] = [...customThemes, ...LANDSCAPE_THEMES];
  const currentTheme =
    allThemes.find((t) => t.id === config.activeThemeId) || LANDSCAPE_THEMES[0];
  const currentThemeMedia = config.themeWallpapers[config.activeThemeId];
  const diy: DiyPlayerStyle = { ...DEFAULT_DIY_STYLE, ...(config.diyStyle || {}) };
  const effectiveAccent = diy.customPrimaryHex || currentTheme.accentHex;

  const updateDiy = (patch: Partial<DiyPlayerStyle>) => {
    triggerHaptic(10);
    onUpdateConfig({
      ...config,
      diyStyle: {
        ...diy,
        ...patch,
      },
    });
  };

  const handleSelectTheme = (themeId: string) => {
    triggerHaptic(15);
    onUpdateConfig({
      ...config,
      activeThemeId: themeId,
      useAlbumArtFallback: false,
    });
  };

  const handleToggleAlbumArt = () => {
    triggerHaptic(15);
    onUpdateConfig({
      ...config,
      useAlbumArtFallback: !config.useAlbumArtFallback,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic(20);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(file.name);
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result as string;
      const updatedWallpapers = {
        ...config.themeWallpapers,
        [config.activeThemeId]: {
          mediaType: isVideo ? ('video' as const) : ('image' as const),
          url: result,
        },
      };

      onUpdateConfig({
        ...config,
        themeWallpapers: updatedWallpapers,
      });
    };

    reader.readAsDataURL(file);
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    triggerHaptic(20);
    const isVideo = /\.(mp4|webm)$/i.test(urlInput);
    onUpdateConfig({
      ...config,
      themeWallpapers: {
        ...config.themeWallpapers,
        [config.activeThemeId]: {
          mediaType: isVideo ? ('video' as const) : ('image' as const),
          url: urlInput.trim(),
        },
      },
    });
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleResetThemeMedia = () => {
    triggerHaptic(20);
    const updated = { ...config.themeWallpapers };
    delete updated[config.activeThemeId];
    onUpdateConfig({
      ...config,
      themeWallpapers: updated,
    });
  };

  const handleGenerateOver4K = async () => {
    const cleanPrompt = aiPrompt.trim();
    const cleanName = aiName.trim() || 'AI Custom Universe';
    if (!cleanPrompt) {
      setGenError('Describe the world or scene you want to paint in >4K.');
      return;
    }

    triggerHaptic(20);
    setGenError(null);
    setSavedNotice(null);
    setIsGenerating(true);
    try {
      setGenStage('Composing scene blueprint with Gemini 3.8 Flash...');
      const { composition, source, note } = await generateAiThemeComposition({
        prompt: cleanPrompt,
        themeName: cleanName,
        artStyle: aiStyle,
      });

      const preset = AI_RESOLUTION_PRESETS[aiResolution];
      setGenStage(`Rendering native ${preset.width}×${preset.height} (>4K) artwork...`);
      const rendered = await renderSceneToOver4KImage(
        composition,
        cleanPrompt,
        aiResolution,
        aiStyle
      );

      setGeneratedArt({
        ...rendered,
        blueprint: composition,
        sourceNote:
          source === 'offline-engine'
            ? note || 'Composed via Local Painterly Engine (>4K)'
            : `Directed by ${source} • ${rendered.width}×${rendered.height}px`,
      });
      if (!aiBadge.trim() || aiBadge === 'AI 4K+ Original') {
        setAiBadge(composition.badge);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Unable to generate >4K artwork.');
    } finally {
      setIsGenerating(false);
      setGenStage('');
    }
  };

  const handleSaveGeneratedToThemes = async () => {
    if (!generatedArt) return;
    triggerHaptic(25);
    const cleanName = aiName.trim() || generatedArt.blueprint.themeName || 'AI Universe';
    const cleanBadge = aiBadge.trim() || generatedArt.blueprint.badge || 'AI >4K Master';
    const preset = AI_RESOLUTION_PRESETS[aiResolution];
    const newId = `ai-${Date.now()}`;

    const record: CustomThemeRecord = {
      id: newId,
      name: cleanName,
      category: 'AI Studio (>4K)',
      scenePrompt: aiPrompt.trim(),
      defaultWallpaper: generatedArt.dataUrl,
      wallpaperDataUrl: generatedArt.dataUrl,
      accentHex: generatedArt.blueprint.palette.primaryGlow || '#38bdf8',
      accentName: cleanBadge,
      accentGlow: `${generatedArt.blueprint.palette.primaryGlow || '#38bdf8'}66`,
      overlayEffect: generatedArt.blueprint.suggestedEffect || 'stars',
      badge: cleanBadge,
      resolutionLabel: preset.shortLabel,
      width: generatedArt.width,
      height: generatedArt.height,
      artStyle: aiStyle,
      isCustomAi: true,
      createdAt: Date.now(),
    };

    await onSaveCustomTheme(record);
    onUpdateConfig({
      ...config,
      activeThemeId: newId,
      useAlbumArtFallback: false,
    });
    setSavedNotice(`Saved "${cleanName}" (${generatedArt.width}×${generatedArt.height}) to Themes Collection & applied!`);
    setCategoryFilter('all');
    setTimeout(() => {
      setActiveTab('themes');
    }, 650);
  };

  const copyPromptForTheme = (theme: LandscapeTheme) => {
    triggerHaptic(15);
    const fullPrompt = `${MASTER_CHATGPT_PROMPT} ${theme.scenePrompt}`;
    navigator.clipboard.writeText(fullPrompt);
    setCopiedThemeId(theme.id);
    setTimeout(() => setCopiedThemeId(null), 3000);
  };

  const categories: ('all' | ThemeCategory)[] = [
    'all',
    'AI Studio (>4K)',
    'Comics & Heroes',
    'Dark Fantasy & Anime',
    'Cyberpunk & Sci-Fi',
    'Atmospheric & Myth',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0b111e]/95 backdrop-blur-3xl border border-white/15 p-5 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col">
        {/* Top Handle for mobile */}
        <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold border shadow-md flex-shrink-0"
              style={{
                backgroundColor: `${effectiveAccent}25`,
                color: effectiveAccent,
                borderColor: `${effectiveAccent}60`,
              }}
            >
              ◐
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">
                Themes, AI &gt;4K &amp; DIY Studio
              </h2>
              <p className="text-xs text-slate-400 truncate">
                Active: {currentTheme.name} · {currentTheme.resolutionLabel || '2432×4320 · 4K+'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4-Tab Studio Bar */}
        <div className="mt-3 grid grid-cols-4 gap-1 p-1 bg-black/45 rounded-2xl border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setActiveTab('themes');
            }}
            className={`py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 min-h-[40px] ${
              activeTab === 'themes'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>◐ Themes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setActiveTab('ai');
            }}
            className={`py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 min-h-[40px] ${
              activeTab === 'ai'
                ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>AI &gt;4K</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setActiveTab('diy');
            }}
            className={`py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 min-h-[40px] ${
              activeTab === 'diy'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-black font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5 flex-shrink-0" />
            <span>DIY Style</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic(10);
              setActiveTab('tuning');
            }}
            className={`py-2 px-1.5 rounded-xl transition flex items-center justify-center gap-1 min-h-[40px] ${
              activeTab === 'tuning'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 flex-shrink-0" />
            <span>FX</span>
          </button>
        </div>

        {/* TAB 1: THEMES COLLECTION */}
        {activeTab === 'themes' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Active Theme Showcase Card */}
            <div className="relative rounded-2xl overflow-hidden border border-white/20 p-4 bg-gradient-to-b from-white/[0.08] to-black/60 shadow-xl backdrop-blur-xl">
              <div className="absolute inset-0 -z-10 overflow-hidden opacity-40">
                {currentThemeMedia?.mediaType === 'video' ? (
                  <video
                    src={currentThemeMedia.url}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={currentThemeMedia?.url || currentTheme.defaultWallpaper}
                    alt={currentTheme.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/45" />
              </div>

              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: effectiveAccent }}
                    />
                    <span className="text-[11px] font-mono text-slate-300 truncate">
                      {currentTheme.badge} · {currentTheme.resolutionLabel || '2432×4320 · 4K+'}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-white truncate">
                    {currentTheme.name}
                  </h3>
                  <p className="text-[11px] text-slate-300 max-w-sm mt-0.5 line-clamp-2">
                    {currentTheme.scenePrompt}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0 text-[10px] font-mono">
                  <span
                    className="font-bold"
                    style={{ color: effectiveAccent }}
                  >
                    {currentThemeMedia ? 'Custom Media' : currentTheme.isCustomAi ? 'AI >4K Saved' : '4K+ Built-In'}
                  </span>
                  <span className="text-slate-400">
                    FX: {diy.overlayEffectOverride !== 'theme-default' ? diy.overlayEffectOverride : currentTheme.overlayEffect}
                  </span>
                </div>
              </div>

              {/* DIY Upload / Link Media */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    fileInputRef.current?.click();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-xs text-black flex items-center justify-center gap-1.5 active:scale-95 transition shadow-lg shadow-cyan-500/20 min-h-[42px]"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image/Video</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-slate-200 border border-white/10 flex items-center justify-center gap-1.5 transition min-h-[42px]"
                >
                  <Film className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Link Media URL</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4,video/webm,video/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              {showUrlInput && (
                <form onSubmit={handleAddUrl} className="mt-3 flex gap-2">
                  <input
                    type="url"
                    placeholder="Paste image or mp4 video URL..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 text-black text-xs font-bold rounded-xl"
                  >
                    Apply
                  </button>
                </form>
              )}

              {currentThemeMedia && (
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                  <span className="text-slate-400 text-[11px]">Custom media active for this theme</span>
                  <button
                    type="button"
                    onClick={handleResetThemeMedia}
                    className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold text-[11px]"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Art</span>
                  </button>
                </div>
              )}
            </div>

            {/* Song Cover Mode Toggle */}
            <button
              type="button"
              onClick={handleToggleAlbumArt}
              className={`w-full p-3.5 rounded-2xl border transition flex items-center justify-between text-left ${
                config.useAlbumArtFallback
                  ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-300'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Disc className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Dynamic Song Cover Mode</div>
                  <div className="text-[11px] text-slate-400">
                    Use the currently playing song&apos;s &gt;4K artwork as background
                  </div>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border flex-shrink-0 ${
                  config.useAlbumArtFallback
                    ? 'bg-cyan-400 border-cyan-400 text-black'
                    : 'border-slate-500'
                }`}
              >
                {config.useAlbumArtFallback && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </button>

            {/* Category Filter Row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  Themes Collection ({allThemes.length} · All &gt;4K)
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>+ Generate New</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                {categories.map((cat) => {
                  const isSel = categoryFilter === cat;
                  const label =
                    cat === 'all'
                      ? `All (${allThemes.length})`
                      : cat === 'AI Studio (>4K)'
                      ? `AI >4K (${customThemes.length})`
                      : cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setCategoryFilter(cat);
                      }}
                      className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition ${
                        isSel
                          ? 'bg-white text-black font-bold shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {categoryFilter === 'AI Studio (>4K)' && customThemes.length === 0 && (
              <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-400/25 text-center space-y-2.5">
                <Wand2 className="w-7 h-7 text-purple-300 mx-auto" />
                <div className="text-sm font-bold text-white">No Saved AI &gt;4K Themes Yet</div>
                <p className="text-xs text-slate-400">
                  Open the AI &gt;4K tab to generate custom 2432×4320 or 5K wallpaper art with a custom Theme Name and save it directly here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-xs font-bold text-white"
                >
                  Open AI &gt;4K Generator
                </button>
              </div>
            )}

            {/* Themes Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {allThemes
                .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
                .map((theme) => {
                  const isSelected = config.activeThemeId === theme.id;
                  const wallpaperUrl =
                    config.themeWallpapers[theme.id]?.url || theme.defaultWallpaper;

                  return (
                    <div
                      key={theme.id}
                      onClick={() => handleSelectTheme(theme.id)}
                      className={`group relative rounded-2xl overflow-hidden cursor-pointer border transition-all active:scale-95 aspect-[4/5] flex flex-col justify-end p-2.5 ${
                        isSelected
                          ? 'border-cyan-400 ring-2 ring-cyan-400/50 shadow-xl shadow-cyan-500/25 scale-[1.02]'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <img
                        src={wallpaperUrl}
                        alt={theme.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent pointer-events-none" />

                      <div className="relative z-10">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: theme.accentHex }}
                          />
                          <span className="text-[10px] font-mono text-slate-300 truncate">
                            {theme.resolutionLabel || '2432×4320 · 4K+'}
                          </span>
                        </div>
                        <h4 className="text-xs font-extrabold text-white leading-tight truncate">
                          {theme.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {theme.badge}
                        </p>
                      </div>

                      {theme.isCustomAi && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic(15);
                            onDeleteCustomTheme(theme.id);
                          }}
                          className="absolute top-2 left-2 z-20 p-1.5 rounded-lg bg-black/70 hover:bg-red-500/80 text-slate-200 hover:text-white border border-white/15 transition"
                          title="Delete custom AI theme"
                          aria-label={`Delete ${theme.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-400 text-black flex items-center justify-center font-bold shadow-lg">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 2: AI >4K IMAGE GENERATOR + SAVE TO THEMES COLLECTION */}
        {activeTab === 'ai' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/15 to-pink-500/15 border border-purple-400/30 space-y-1">
              <div className="font-bold text-white text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-300" />
                <span>AI &gt;4K Theme Generator</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Uses Gemini 3.8 Flash art direction + our native &gt;4K multi-pass Canvas engine (zero paid key needed) to generate up to 5K artwork with a custom name, then saves directly into your Themes Collection.
              </p>
            </div>

            {/* Theme Name & Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300">
                  Theme Name
                </label>
                <input
                  type="text"
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Neon Valkyrie"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-300">
                  Subtitle / Badge Tagline
                </label>
                <input
                  type="text"
                  value={aiBadge}
                  onChange={(e) => setAiBadge(e.target.value)}
                  maxLength={32}
                  placeholder="e.g. Cyber Valhalla"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Art Style */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300">
                Visual Art Style
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AI_ART_STYLES.map((st) => {
                  const active = aiStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setAiStyle(st.id);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        active
                          ? 'bg-purple-500/20 border-purple-400 text-white'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold text-[11px] truncate">{st.label}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{st.subtitle}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Resolution Selector (>4K / 5K) */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300">
                Native Output Resolution (&gt;4K Ultra-HD)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(AI_RESOLUTION_PRESETS).map((res) => {
                  const active = aiResolution === res.id;
                  return (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic(10);
                        setAiResolution(res.id);
                      }}
                      className={`px-3 py-2.5 rounded-xl border text-left transition font-medium ${
                        active
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-[11px] truncate">{res.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scene Prompt + Starters */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-300">
                Scene Prompt
              </label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Describe your wallpaper universe (sky, towers, lighting, hero silhouette)..."
                className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400 leading-relaxed"
              />
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_AI_PROMPTS.map((preset) => (
                  <button
                    key={preset.title}
                    type="button"
                    onClick={() => {
                      triggerHaptic(10);
                      setAiName(preset.title);
                      setAiBadge(preset.badge);
                      setAiStyle(preset.style);
                      setAiPrompt(preset.prompt);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-[11px] text-slate-300 truncate"
                  >
                    Preset: {preset.title}
                  </button>
                ))}
              </div>
            </div>

            {genError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-400/40 text-red-200 text-xs">
                {genError}
              </div>
            )}

            {savedNotice && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs font-semibold">
                {savedNotice}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerateOver4K}
              disabled={isGenerating}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 active:scale-[0.99] transition disabled:opacity-60 min-h-[46px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{genStage || 'Generating >4K Artwork...'}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Generate &gt;4K Theme Artwork</span>
                </>
              )}
            </button>

            {/* Generated Artwork Preview & Save CTA */}
            {generatedArt && (
              <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">
                      {aiName.trim() || generatedArt.blueprint.themeName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {generatedArt.width}×{generatedArt.height} px • ~{generatedArt.approxKb} KB · {generatedArt.sourceNote}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-4 h-4 rounded-full border border-white/30"
                      style={{ backgroundColor: generatedArt.blueprint.palette.primaryGlow }}
                      title="Primary Accent"
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white/30"
                      style={{ backgroundColor: generatedArt.blueprint.palette.secondaryGlow }}
                      title="Secondary Highlight"
                    />
                  </div>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black max-h-72 flex items-center justify-center">
                  <img
                    src={generatedArt.dataUrl}
                    alt={aiName}
                    className="w-full h-72 object-contain"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSaveGeneratedToThemes}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg min-h-[44px]"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                    <span>Save to Themes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic(15);
                      const slug = (aiName.trim() || 'prime-one-ai')
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-');
                      downloadDataUrl(generatedArt.dataUrl, `${slug}-${generatedArt.width}x${generatedArt.height}.jpg`);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                    <span>Download &gt;4K</span>
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible ChatGPT 9:16 Prompt Helper */}
            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPromptLibrary((p) => !p)}
                className="w-full px-3.5 py-3 flex items-center justify-between text-left hover:bg-white/5 transition"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-300" />
                  <span className="font-bold text-white text-xs">
                    ChatGPT / Midjourney 9:16 Master Prompt Formulas
                  </span>
                </div>
                {showPromptLibrary ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showPromptLibrary && (
                <div className="px-3.5 pb-3.5 space-y-2 border-t border-white/10 pt-3">
                  <p className="text-[11px] text-slate-400">
                    Copy any universe prompt below for external image tools, then upload back in the Themes tab:
                  </p>
                  {LANDSCAPE_THEMES.map((theme) => {
                    const isCopied = copiedThemeId === theme.id;
                    return (
                      <div
                        key={theme.id}
                        className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white text-[11px] truncate">{theme.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{theme.scenePrompt}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyPromptForTheme(theme)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 flex-shrink-0 ${
                            isCopied ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white'
                          }`}
                        >
                          {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LITERALLY DIY CUSTOMIZATION STUDIO */}
        {activeTab === 'diy' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            {/* 1. ICONS */}
            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-xs">
                <Shapes className="w-4 h-4 text-cyan-400" />
                <span>1. Icons (Pack Style &amp; Button Shape)</span>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Icon Stroke &amp; Style</div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'classic', label: 'Classic' },
                      { id: 'comic', label: 'Comic Ink' },
                      { id: 'neon', label: 'Neon Glow' },
                      { id: 'duotone', label: 'Duotone' },
                      { id: 'thin', label: 'Ultra Thin' },
                    ] as { id: DiyIconPack; label: string }[]
                  ).map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => updateDiy({ iconPack: pack.id })}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition min-h-[40px] ${
                        diy.iconPack === pack.id
                          ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {pack.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Icon Button Shape</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'rounded', label: 'Rounded' },
                      { id: 'circle', label: 'Circle' },
                      { id: 'sharp', label: 'Square' },
                      { id: 'soft', label: 'Squircle' },
                    ] as { id: DiyIconShape; label: string }[]
                  ).map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      onClick={() => updateDiy({ iconShape: sh.id })}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition min-h-[40px] ${
                        diy.iconShape === sh.id
                          ? 'bg-cyan-500 text-black border-cyan-400 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. WIDGET APPEARANCE */}
            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-xs">
                <LayoutTemplate className="w-4 h-4 text-emerald-400" />
                <span>2. Widget Appearance (Mini-Player &amp; Home Widget)</span>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Player Bar &amp; Widget Layout</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'docked-bar', label: 'Docked Bar' },
                      { id: 'floating-pill', label: 'Floating Pill' },
                      { id: 'glass-card', label: 'Glass Card' },
                      { id: 'minimal-slim', label: 'Minimal Slim' },
                      { id: 'vinyl-dock', label: 'Spinning Vinyl' },
                    ] as { id: DiyWidgetStyle; label: string }[]
                  ).map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => updateDiy({ widgetStyle: w.id })}
                      className={`py-2 px-2.5 rounded-xl border text-[11px] font-semibold transition min-h-[40px] ${
                        diy.widgetStyle === w.id
                          ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Widget Cover Shape</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'rounded', label: 'Rounded' },
                      { id: 'circle', label: 'Circle' },
                      { id: 'square', label: 'Square' },
                    ] as { id: DiyWidgetArtShape; label: string }[]
                  ).map((art) => (
                    <button
                      key={art.id}
                      type="button"
                      onClick={() => updateDiy({ widgetArtShape: art.id })}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition min-h-[40px] ${
                        diy.widgetArtShape === art.id
                          ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {art.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Widget Surface Opacity</span>
                  <span className="font-mono text-emerald-300 font-bold">
                    {Math.round(diy.widgetOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={1.0}
                  step={0.05}
                  value={diy.widgetOpacity}
                  onChange={(e) => updateDiy({ widgetOpacity: Number(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateDiy({ widgetShowProgress: !diy.widgetShowProgress })}
                  className={`py-2.5 px-3 rounded-xl border text-[11px] font-bold transition min-h-[42px] ${
                    diy.widgetShowProgress
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-black/40 border-white/10 text-slate-400'
                  }`}
                >
                  Progress Bar: {diy.widgetShowProgress ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  onClick={() => updateDiy({ widgetShowFavorite: !diy.widgetShowFavorite })}
                  className={`py-2.5 px-3 rounded-xl border text-[11px] font-bold transition min-h-[42px] ${
                    diy.widgetShowFavorite
                      ? 'bg-pink-500/20 border-pink-400 text-pink-200'
                      : 'bg-black/40 border-white/10 text-slate-400'
                  }`}
                >
                  Heart Button: {diy.widgetShowFavorite ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* 3. SCREEN STYLE */}
            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-3">
              <div className="flex items-center gap-2 font-bold text-white text-xs">
                <Eye className="w-4 h-4 text-violet-400" />
                <span>3. Screen Style (Cards, Surface &amp; Full-Player Art)</span>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Surface Architecture</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'obsidian-glass', label: 'Obsidian Glass' },
                      { id: 'amoled-black', label: 'AMOLED Black' },
                      { id: 'comic-panel', label: 'Comic Ink Panel' },
                      { id: 'neon-hud', label: 'Cyber Neon HUD' },
                      { id: 'borderless-air', label: 'Borderless Air' },
                    ] as { id: DiyScreenStyle; label: string }[]
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => updateDiy({ screenStyle: sc.id })}
                      className={`py-2 px-2.5 rounded-xl border text-[11px] font-semibold transition min-h-[40px] ${
                        diy.screenStyle === sc.id
                          ? 'bg-violet-500 text-white border-violet-400 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Track &amp; Album Card Corners</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'sharp', label: 'Sharp Box' },
                      { id: 'rounded', label: 'Rounded' },
                      { id: 'pill', label: 'Extra Pill' },
                    ] as { id: DiyCardRadius; label: string }[]
                  ).map((cr) => (
                    <button
                      key={cr.id}
                      type="button"
                      onClick={() => updateDiy({ cardRadius: cr.id })}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition min-h-[40px] ${
                        diy.cardRadius === cr.id
                          ? 'bg-violet-500 text-white border-violet-400 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {cr.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Now-Playing Hero Frame</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'poster', label: 'Poster' },
                      { id: 'framed', label: 'Comic Frame' },
                      { id: 'vinyl', label: 'Vinyl Disc' },
                      { id: 'aurora-halo', label: 'Aurora Halo' },
                    ] as { id: DiyHeroArtMode; label: string }[]
                  ).map((hm) => (
                    <button
                      key={hm.id}
                      type="button"
                      onClick={() => updateDiy({ heroArtMode: hm.id })}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-semibold transition min-h-[40px] ${
                        diy.heroArtMode === hm.id
                          ? 'bg-violet-500 text-white border-violet-400 font-bold'
                          : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {hm.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. COLORS & VISUAL EFFECTS */}
            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white text-xs">
                  <Palette className="w-4 h-4 text-amber-400" />
                  <span>4. Colors &amp; Visual Effects</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateDiy(DEFAULT_DIY_STYLE)}
                  className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset DIY</span>
                </button>
              </div>

              {/* Accent Swatches */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Quick Accent Swatches</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateDiy({
                        customPrimaryHex: '',
                        customSecondaryHex: '',
                        customSurfaceHex: '',
                      })
                    }
                    className="text-cyan-300 hover:underline font-semibold"
                  >
                    Follow Theme Default
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {ACCENT_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => updateDiy({ customPrimaryHex: hex })}
                      className={`w-9 h-9 rounded-full border-2 transition active:scale-90 ${
                        diy.customPrimaryHex.toLowerCase() === hex.toLowerCase()
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/25'
                      }`}
                      style={{ backgroundColor: hex }}
                      aria-label={`Use accent ${hex}`}
                    />
                  ))}
                </div>
              </div>

              {/* 3 Custom Hex Pickers */}
              <div className="grid grid-cols-3 gap-2">
                <label className="p-2 rounded-xl bg-black/40 border border-white/10 space-y-1 cursor-pointer">
                  <span className="block text-[10px] text-slate-400">Primary Color</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={diy.customPrimaryHex || currentTheme.accentHex}
                      onChange={(e) => updateDiy({ customPrimaryHex: e.target.value })}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-[10px] text-white truncate">
                      {diy.customPrimaryHex || 'Auto'}
                    </span>
                  </div>
                </label>

                <label className="p-2 rounded-xl bg-black/40 border border-white/10 space-y-1 cursor-pointer">
                  <span className="block text-[10px] text-slate-400">Highlight Color</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={diy.customSecondaryHex || '#8b5cf6'}
                      onChange={(e) => updateDiy({ customSecondaryHex: e.target.value })}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-[10px] text-white truncate">
                      {diy.customSecondaryHex || 'Auto'}
                    </span>
                  </div>
                </label>

                <label className="p-2 rounded-xl bg-black/40 border border-white/10 space-y-1 cursor-pointer">
                  <span className="block text-[10px] text-slate-400">Surface Tint</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={diy.customSurfaceHex || '#070b14'}
                      onChange={(e) => updateDiy({ customSurfaceHex: e.target.value })}
                      className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                    />
                    <span className="font-mono text-[10px] text-white truncate">
                      {diy.customSurfaceHex || 'Auto'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Visual Effect Override */}
              <div className="space-y-1.5">
                <label className="block text-[11px] text-slate-400 font-medium">
                  Animated Visual Effect Override
                </label>
                <select
                  value={diy.overlayEffectOverride}
                  onChange={(e) =>
                    updateDiy({
                      overlayEffectOverride: e.target.value as 'theme-default' | OverlayEffectType,
                    })
                  }
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  {OVERLAY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-[#0b111e] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Effect Intensity & Ambient Glow */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Visual Effect Intensity</span>
                  <span className="font-mono text-cyan-300 font-bold">
                    {Math.round(diy.effectIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={1.5}
                  step={0.05}
                  value={diy.effectIntensity}
                  onChange={(e) => updateDiy({ effectIntensity: Number(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Ambient Glow Bloom</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {Math.round(diy.glowIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={diy.glowIntensity}
                  onChange={(e) => updateDiy({ glowIntensity: Number(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FX, BLUR & DIM TUNING */}
        {activeTab === 'tuning' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Animated Particles &amp; Waves
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Active effect:{' '}
                    {diy.overlayEffectOverride !== 'theme-default'
                      ? diy.overlayEffectOverride
                      : currentTheme.overlayEffect}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    onUpdateConfig({
                      ...config,
                      enableAtmosphericEffects: !config.enableAtmosphericEffects,
                    });
                  }}
                  className={`px-3 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
                    config.enableAtmosphericEffects
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/25'
                      : 'bg-white/10 text-slate-400'
                  }`}
                >
                  <span>{config.enableAtmosphericEffects ? 'ON' : 'OFF'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Turn OFF to display clean &gt;4K artwork without live animated overlays.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Top &amp; Bottom Dark Vignette
                </div>
                <div className="text-[11px] text-slate-400">
                  Gradient frame for crystal-clear song titles &amp; buttons
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  onUpdateConfig({
                    ...config,
                    extraVignette: !config.extraVignette,
                  });
                }}
                className={`px-3 py-2 rounded-full text-xs font-bold transition flex-shrink-0 ${
                  config.extraVignette
                    ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {config.extraVignette ? 'ENABLED' : 'OFF'}
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  Frosted Glass Blur
                </span>
                <span className="font-mono text-cyan-300 font-bold">{config.blur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={config.blur}
                onChange={(e) => onUpdateConfig({ ...config, blur: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0px (Crisp &gt;4K Art)</span>
                <span>25px (Frosted Acrylic)</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.06] border border-white/15 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  Background Dim / Darkness
                </span>
                <span className="font-mono text-amber-300 font-bold">
                  {Math.round(config.dim * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.15}
                max={0.85}
                step={0.05}
                value={config.dim}
                onChange={(e) => onUpdateConfig({ ...config, dim: Number(e.target.value) })}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>15% (Bright Art)</span>
                <span>85% (AMOLED Dark)</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              triggerHaptic(20);
              onUpdateConfig({
                activeThemeId: 'prime-one',
                themeWallpapers: {},
                enableAtmosphericEffects: true,
                blur: 0,
                dim: 0.38,
                extraVignette: true,
                useAlbumArtFallback: false,
                diyStyle: DEFAULT_DIY_STYLE,
              });
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-white/5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 active:scale-95 transition min-h-[42px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
