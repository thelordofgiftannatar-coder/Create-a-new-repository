import primeOneDualityImg from '../assets/images/prime_one_duality_14b39341.jpg';
import absoluteDcImg from '../assets/images/absolute_dc_universe_1794251610177.jpg';
import batmanImg from '../assets/images/batman_gotham_universe_1794251607365.jpg';
import justiceLeagueImg from '../assets/images/justice_league_universe_1794251654111.jpg';
import avengersImg from '../assets/images/avengers_nyc_universe_1794251691834.jpg';
import marvelImg from '../assets/images/marvel_heroic_universe_1794251636361.jpg';
import medievalImg from '../assets/images/medieval_castle_universe_1794251674994.jpg';
import forestImg from '../assets/images/forest_glade_universe_1794251675084.jpg';
import dndImg from '../assets/images/dnd_tavern_universe_1794251674722.jpg';
import harryPotterImg from '../assets/images/harry_potter_universe_1794251673750.jpg';
import bladeRunnerImg from '../assets/images/blade_runner_universe_1794251652668.jpg';
import cyberpunkImg from '../assets/images/cyberpunk_2077_universe_1794251650987.jpg';
import duneImg from '../assets/images/dune_arrakis_universe_1794251652361.jpg';
import mazeRunnerImg from '../assets/images/maze_runner_universe_1794251691338.jpg';
import ghostInShellImg from '../assets/images/ghost_in_shell_universe_1794251672963.jpg';
import evangelionImg from '../assets/images/evangelion_universe_1794251653458.jpg';
import vinlandSagaImg from '../assets/images/vinland_saga_universe_1794251608091.jpg';
import berserkImg from '../assets/images/berserk_eclipse_universe_1794251609278.jpg';

export const MASTER_CHATGPT_PROMPT = `Create a vertical phone wallpaper, 9:16 aspect ratio (1080×2400). Style: detailed painterly comic-book illustration with heavy ink linework, rich cinematic lighting, atmospheric haze and light beams, highly detailed architecture, like a modern premium graphic novel splash page. No text, no letters, no logos, no speech bubbles, no watermark. Keep the upper-middle and the bottom fairly dark and calm so text on top stays readable. The scene:`;

export type OverlayEffectType =
  | 'red-smoke'
  | 'rain'
  | 'stars'
  | 'portal'
  | 'embers'
  | 'fireflies'
  | 'candles'
  | 'digital-rain'
  | 'snow'
  | 'sandstorm'
  | 'aurora-waves'
  | 'prism-rays'
  | 'scanlines'
  | 'none';

export type ThemeCategory =
  | 'Comics & Heroes'
  | 'Cyberpunk & Sci-Fi'
  | 'Dark Fantasy & Anime'
  | 'Atmospheric & Myth'
  | 'AI Studio (>4K)';

export interface LandscapeTheme {
  id: string;
  name: string;
  category: ThemeCategory;
  scenePrompt: string;
  defaultWallpaper: string;
  accentHex: string;
  accentName: string;
  accentGlow: string;
  overlayEffect: OverlayEffectType;
  badge: string;
  resolutionLabel?: string;
  isCustomAi?: boolean;
  createdAt?: number;
}

export interface CustomThemeRecord extends LandscapeTheme {
  isCustomAi: true;
  wallpaperDataUrl: string;
  width: number;
  height: number;
  artStyle: string;
  createdAt: number;
}

export type DiyIconPack = 'classic' | 'comic' | 'neon' | 'duotone' | 'thin';
export type DiyIconShape = 'rounded' | 'circle' | 'sharp' | 'soft';
export type DiyWidgetStyle = 'docked-bar' | 'floating-pill' | 'glass-card' | 'minimal-slim' | 'vinyl-dock';
export type DiyWidgetArtShape = 'rounded' | 'circle' | 'square';
export type DiyScreenStyle = 'obsidian-glass' | 'amoled-black' | 'comic-panel' | 'neon-hud' | 'borderless-air';
export type DiyCardRadius = 'sharp' | 'rounded' | 'pill';
export type DiyHeroArtMode = 'poster' | 'framed' | 'vinyl' | 'aurora-halo';

export interface DiyPlayerStyle {
  // 1. Icons
  iconPack: DiyIconPack;
  iconShape: DiyIconShape;
  // 2. Widget Appearance
  widgetStyle: DiyWidgetStyle;
  widgetArtShape: DiyWidgetArtShape;
  widgetOpacity: number;
  widgetShowProgress: boolean;
  widgetShowFavorite: boolean;
  // 3. Screen Style
  screenStyle: DiyScreenStyle;
  cardRadius: DiyCardRadius;
  heroArtMode: DiyHeroArtMode;
  // 4. Colors & Visual Effects
  customPrimaryHex: string; // '' = follow active theme
  customSecondaryHex: string; // '' = follow theme complement
  customSurfaceHex: string; // '' = follow dark obsidian
  overlayEffectOverride: 'theme-default' | OverlayEffectType;
  effectIntensity: number; // 0.25 to 1.5
  glowIntensity: number; // 0 to 1.0
}

export const DEFAULT_DIY_STYLE: DiyPlayerStyle = {
  iconPack: 'classic',
  iconShape: 'rounded',
  widgetStyle: 'docked-bar',
  widgetArtShape: 'rounded',
  widgetOpacity: 0.85,
  widgetShowProgress: true,
  widgetShowFavorite: true,
  screenStyle: 'obsidian-glass',
  cardRadius: 'rounded',
  heroArtMode: 'poster',
  customPrimaryHex: '',
  customSecondaryHex: '',
  customSurfaceHex: '',
  overlayEffectOverride: 'theme-default',
  effectIntensity: 1.0,
  glowIntensity: 0.35,
};

export const LANDSCAPE_THEMES: LandscapeTheme[] = [
  {
    id: 'prime-one',
    name: 'Prime One · Day & Cosmos',
    category: 'Atmospheric & Myth',
    scenePrompt: 'a lone heroic figure standing arms wide atop a crystalline rift dividing golden sunlit clouds on the left from deep starry nebula cosmos on the right, dramatic painterly oil texture.',
    defaultWallpaper: primeOneDualityImg,
    accentHex: '#38bdf8',
    accentName: 'Cosmic Duality',
    accentGlow: 'rgba(56, 189, 248, 0.45)',
    overlayEffect: 'stars',
    badge: 'Prime One Original',
    resolutionLabel: '2304×4608 · 4K+',
  },
  {
    id: 'absolute-dc',
    name: 'Absolute DC',
    category: 'Comics & Heroes',
    scenePrompt: 'a huge gothic Gotham skyline at dusk over dark water, blood-red smoky sky, airships with searchlights, a black stealth vehicle on the river.',
    defaultWallpaper: absoluteDcImg,
    accentHex: '#ef4444',
    accentName: 'Blood Red',
    accentGlow: 'rgba(239, 68, 68, 0.4)',
    overlayEffect: 'red-smoke',
    badge: 'Absolute Gotham',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'batman',
    name: 'Batman',
    category: 'Comics & Heroes',
    scenePrompt: 'Gotham rooftop at night in heavy rain, gargoyles, the bat-signal cutting through storm clouds, a caped silhouette on the ledge.',
    defaultWallpaper: batmanImg,
    accentHex: '#eab308',
    accentName: 'Bat Yellow',
    accentGlow: 'rgba(234, 179, 8, 0.35)',
    overlayEffect: 'rain',
    badge: 'Gotham & Bat-Signal',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'justice-league',
    name: 'Justice League',
    category: 'Comics & Heroes',
    scenePrompt: 'the orbital Watchtower above Earth, glowing blue planet limb, seven heroic silhouettes in a ring, stars.',
    defaultWallpaper: justiceLeagueImg,
    accentHex: '#38bdf8',
    accentName: 'Orbital Cyan',
    accentGlow: 'rgba(56, 189, 248, 0.4)',
    overlayEffect: 'stars',
    badge: 'Watchtower Orbital',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'avengers',
    name: 'The Avengers',
    category: 'Comics & Heroes',
    scenePrompt: 'a ruined New York street at dusk, glowing blue energy portal in the sky, heroic silhouettes with a shield and a hammer.',
    defaultWallpaper: avengersImg,
    accentHex: '#60a5fa',
    accentName: 'Portal Blue',
    accentGlow: 'rgba(96, 165, 250, 0.4)',
    overlayEffect: 'portal',
    badge: 'Battle of New York',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'marvel',
    name: 'Marvel',
    category: 'Comics & Heroes',
    scenePrompt: 'a heroic city skyline at sunset with a red-and-gold sky, a flying hero silhouette, dramatic comic-cover lighting.',
    defaultWallpaper: marvelImg,
    accentHex: '#f59e0b',
    accentName: 'Heroic Gold',
    accentGlow: 'rgba(245, 158, 11, 0.4)',
    overlayEffect: 'embers',
    badge: 'MCU Heroic Splash',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'medieval-times',
    name: 'Medieval Times',
    category: 'Atmospheric & Myth',
    scenePrompt: 'a stone castle on a cliff at dusk, torch-lit walls, banners, a village below, drifting mist.',
    defaultWallpaper: medievalImg,
    accentHex: '#d97706',
    accentName: 'Torch Amber',
    accentGlow: 'rgba(217, 119, 6, 0.35)',
    overlayEffect: 'embers',
    badge: 'Clifftop Fortress',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'forest',
    name: 'Forest',
    category: 'Atmospheric & Myth',
    scenePrompt: 'an ancient misty forest with god-rays through giant trees, glowing fireflies, a mossy stone path.',
    defaultWallpaper: forestImg,
    accentHex: '#10b981',
    accentName: 'Emerald Ray',
    accentGlow: 'rgba(16, 185, 129, 0.4)',
    overlayEffect: 'fireflies',
    badge: 'Primordial Glade',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'dnd',
    name: 'D&D',
    category: 'Dark Fantasy & Anime',
    scenePrompt: 'a tavern table with a map, dice, candles and a spellbook, a red dragon silhouette in the window, warm firelight.',
    defaultWallpaper: dndImg,
    accentHex: '#ea580c',
    accentName: 'Dragon Flame',
    accentGlow: 'rgba(234, 88, 12, 0.4)',
    overlayEffect: 'embers',
    badge: 'Adventurer Tavern',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'harry-potter',
    name: 'Harry Potter',
    category: 'Dark Fantasy & Anime',
    scenePrompt: 'a candlelit gothic castle hall at night, floating candles, an owl in the rafters, a moonlit stained-glass window, starry sky.',
    defaultWallpaper: harryPotterImg,
    accentHex: '#fbbf24',
    accentName: 'Gothic Candle',
    accentGlow: 'rgba(251, 191, 36, 0.35)',
    overlayEffect: 'candles',
    badge: 'Hogwarts Great Hall',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'blade-runner',
    name: 'Blade Runner',
    category: 'Cyberpunk & Sci-Fi',
    scenePrompt: 'a rainy neon megacity street, flying cars, giant glowing holographic ads, orange smog and teal neon, wet reflective ground, a lone figure with an umbrella.',
    defaultWallpaper: bladeRunnerImg,
    accentHex: '#06b6d4',
    accentName: 'Cyber Teal',
    accentGlow: 'rgba(6, 182, 212, 0.45)',
    overlayEffect: 'rain',
    badge: '2049 Rain & Spinners',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'cyberpunk-2077',
    name: 'Cyberpunk 2077',
    category: 'Cyberpunk & Sci-Fi',
    scenePrompt: 'Night City at night, yellow and cyan neon, towering corporate skyscrapers, packed street with neon signs, rain, a netrunner silhouette.',
    defaultWallpaper: cyberpunkImg,
    accentHex: '#facc15',
    accentName: 'Night City Yellow',
    accentGlow: 'rgba(250, 204, 21, 0.45)',
    overlayEffect: 'rain',
    badge: 'Night City Netrunner',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'dune',
    name: 'Dune',
    category: 'Cyberpunk & Sci-Fi',
    scenePrompt: 'the desert planet Arrakis, giant dunes at sunrise, two moons, a huge sandworm ridge in the distance, a tiny figure in a stillsuit.',
    defaultWallpaper: duneImg,
    accentHex: '#f97316',
    accentName: 'Arrakis Spice',
    accentGlow: 'rgba(249, 115, 22, 0.35)',
    overlayEffect: 'sandstorm',
    badge: 'Arrakis Sandworm',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'maze-runner',
    name: 'Maze Runner',
    category: 'Atmospheric & Myth',
    scenePrompt: 'a vast ivy-covered stone maze corridor with a giant gap at the end, a lone runner, harsh light from above.',
    defaultWallpaper: mazeRunnerImg,
    accentHex: '#84cc16',
    accentName: 'Ivy Lime',
    accentGlow: 'rgba(132, 204, 22, 0.35)',
    overlayEffect: 'fireflies',
    badge: 'Glade Stone Maze',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'ghost-in-the-shell',
    name: 'Ghost in the Shell',
    category: 'Cyberpunk & Sci-Fi',
    scenePrompt: 'a rainy cyberpunk Hong Kong–style skyline, green holographic code in the air, a cyborg woman on a rooftop at night.',
    defaultWallpaper: ghostInShellImg,
    accentHex: '#22c55e',
    accentName: 'Cyber Green',
    accentGlow: 'rgba(34, 197, 94, 0.45)',
    overlayEffect: 'digital-rain',
    badge: 'Section 9 Motoko',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'evangelion',
    name: 'Neon Genesis Evangelion',
    category: 'Dark Fantasy & Anime',
    scenePrompt: 'a ruined city under a blood-orange sky, a giant biomechanical purple mech, glowing hexagon barrier in the air.',
    defaultWallpaper: evangelionImg,
    accentHex: '#a855f7',
    accentName: 'Unit-01 Purple',
    accentGlow: 'rgba(168, 85, 247, 0.45)',
    overlayEffect: 'red-smoke',
    badge: 'Unit-01 AT-Field',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'vinland-saga',
    name: 'Vinland Saga',
    category: 'Atmospheric & Myth',
    scenePrompt: 'a Viking longship at dawn on a cold grey sea, fog, snow, a lone warrior at the bow.',
    defaultWallpaper: vinlandSagaImg,
    accentHex: '#94a3b8',
    accentName: 'Nordic Frost',
    accentGlow: 'rgba(148, 163, 184, 0.35)',
    overlayEffect: 'snow',
    badge: 'Thorfinn Drakkar',
    resolutionLabel: '2432×4320 · 4K+',
  },
  {
    id: 'berserk',
    name: 'Berserk',
    category: 'Dark Fantasy & Anime',
    scenePrompt: 'a dark gothic wasteland under a red eclipse, a lone swordsman with a giant sword, skeletal trees and ash.',
    defaultWallpaper: berserkImg,
    accentHex: '#dc2626',
    accentName: 'Crimson Eclipse',
    accentGlow: 'rgba(220, 38, 38, 0.5)',
    overlayEffect: 'embers',
    badge: 'Guts & Red Eclipse',
    resolutionLabel: '2432×4320 · 4K+',
  },
];

export interface CustomThemeMedia {
  mediaType: 'image' | 'video';
  url: string;
}

export interface LandscapeThemeConfig {
  activeThemeId: string;
  themeWallpapers: Record<string, CustomThemeMedia>;
  enableAtmosphericEffects: boolean;
  blur: number; // 0 to 25px
  dim: number; // 0.15 to 0.85
  extraVignette: boolean;
  useAlbumArtFallback: boolean;
  diyStyle?: DiyPlayerStyle;
}

export const DEFAULT_LANDSCAPE_CONFIG: LandscapeThemeConfig = {
  activeThemeId: 'prime-one',
  themeWallpapers: {},
  enableAtmosphericEffects: true,
  blur: 0,
  dim: 0.38,
  extraVignette: true,
  useAlbumArtFallback: false,
  diyStyle: DEFAULT_DIY_STYLE,
};

