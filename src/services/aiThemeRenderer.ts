import { OverlayEffectType, ThemeCategory } from '../types/themeLandscape';

export type AiArtStyleId =
  | 'comic-splash'
  | 'cyberpunk-noir'
  | 'dark-fantasy'
  | 'cosmic-myth'
  | 'anime-mecha';

export type AiResolutionPresetId =
  | 'portrait-4k'
  | 'portrait-5k'
  | 'square-4k'
  | 'landscape-4k';

export const AI_RESOLUTION_PRESETS: Record<
  AiResolutionPresetId,
  { id: AiResolutionPresetId; label: string; shortLabel: string; width: number; height: number }
> = {
  'portrait-4k': {
    id: 'portrait-4k',
    label: '2432 × 4320 · >4K Portrait (9:16)',
    shortLabel: '2432×4320 · 4K+',
    width: 2432,
    height: 4320,
  },
  'portrait-5k': {
    id: 'portrait-5k',
    label: '2880 × 5120 · 5K+ Ultra (9:16)',
    shortLabel: '2880×5120 · 5K+',
    width: 2880,
    height: 5120,
  },
  'square-4k': {
    id: 'square-4k',
    label: '4096 × 4096 · >4K Square Cover (1:1)',
    shortLabel: '4096×4096 · 4K+',
    width: 4096,
    height: 4096,
  },
  'landscape-4k': {
    id: 'landscape-4k',
    label: '4320 × 2432 · >4K Widescreen (16:9)',
    shortLabel: '4320×2432 · 4K+',
    width: 4320,
    height: 2432,
  },
};

export const AI_ART_STYLES: { id: AiArtStyleId; label: string; subtitle: string }[] = [
  { id: 'comic-splash', label: 'Graphic Novel Ink', subtitle: 'Heavy ink linework & cinematic rim light' },
  { id: 'cyberpunk-noir', label: 'Cyberpunk Neon', subtitle: 'Rain-slicked towers & holographic haze' },
  { id: 'dark-fantasy', label: 'Dark Fantasy Oil', subtitle: 'Red eclipse, Gothic ruins & embers' },
  { id: 'cosmic-myth', label: 'Cosmic Rift Myth', subtitle: 'Nebula duality, astral clouds & god-rays' },
  { id: 'anime-mecha', label: 'Anime Cel-Shade', subtitle: 'High-contrast sky, hex barriers & silhouette' },
];

export type CelestialType =
  | 'eclipse'
  | 'twin-moons'
  | 'portal'
  | 'full-moon'
  | 'nebula'
  | 'sunburst'
  | 'bat-beacon'
  | 'planet-limb';

export type SkylineType =
  | 'gothic-spires'
  | 'cyberpunk-towers'
  | 'castle-cliff'
  | 'ancient-forest'
  | 'desert-dunes'
  | 'sea-drakkar'
  | 'orbital-ring'
  | 'ruined-cathedral';

export type SilhouetteType =
  | 'lone-warrior'
  | 'caped-vigilante'
  | 'netrunner'
  | 'mage-staff'
  | 'flying-hero'
  | 'viking-bow'
  | 'dual-rift'
  | 'none';

export interface SceneCompositionBlueprint {
  themeName: string;
  badge: string;
  category: ThemeCategory;
  suggestedEffect: OverlayEffectType;
  palette: {
    skyTop: string;
    skyMid: string;
    skyHorizon: string;
    primaryGlow: string;
    secondaryGlow: string;
    architectureDark: string;
    architectureLit: string;
    rimLight: string;
    fogTint: string;
  };
  celestial: {
    type: CelestialType;
    xRatio: number;
    yRatio: number;
    radiusRatio: number;
  };
  skylineType: SkylineType;
  silhouetteType: SilhouetteType;
  architectureDensity: number;
  lightBeams: number;
  starDensity: number;
  rainStreaks: number;
  emberGlow: number;
  vignetteStrength: number;
}

function getApiBaseOrigin(): string {
  const configured = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env?.VITE_API_BASE_URL?.trim();
  return configured ? configured.replace(/\/+$/, '') : '';
}

function createSeededRng(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * Deterministic scene analyzer fallback when offline or if Gemini API key is absent.
 */
export function buildOfflineSceneComposition(
  prompt: string,
  themeName: string,
  artStyle: AiArtStyleId
): SceneCompositionBlueprint {
  const lower = `${themeName} ${prompt}`.toLowerCase();
  const rng = createSeededRng(`${themeName}|${prompt}|${artStyle}`);

  const isCyber =
    artStyle === 'cyberpunk-noir' ||
    /cyber|neon|tokyo|blade|matrix|city|sci-fi|hologram|netrunner|retro|synth|future/.test(lower);
  const isDesert = /dune|desert|sand|arrakis|mars|canyon|sun/.test(lower);
  const isForest = /forest|tree|jungle|elf|nature|glade|emerald|moss|druid/.test(lower);
  const isOcean = /sea|ocean|viking|ship|drakkar|pirate|snow|ice|winter|arctic/.test(lower);
  const isCosmic =
    artStyle === 'cosmic-myth' ||
    /space|galaxy|cosmos|nebula|orbit|star|planet|rift|celestial|angel|god/.test(lower);
  const isFantasy =
    artStyle === 'dark-fantasy' ||
    /eclipse|berserk|gothic|castle|dragon|knight|sword|demon|dark|vampire|blood|wizard|magic/.test(
      lower
    );

  let skylineType: SkylineType = 'gothic-spires';
  if (isCyber) skylineType = 'cyberpunk-towers';
  else if (isForest) skylineType = 'ancient-forest';
  else if (isDesert) skylineType = 'desert-dunes';
  else if (isOcean) skylineType = 'sea-drakkar';
  else if (isCosmic) skylineType = 'orbital-ring';
  else if (/ruin|cathedral/.test(lower)) skylineType = 'ruined-cathedral';
  else if (isFantasy) skylineType = 'castle-cliff';

  let celestialType: CelestialType = 'full-moon';
  if (/eclipse|blood|crimson/.test(lower)) celestialType = 'eclipse';
  else if (/portal|rift|vortex/.test(lower)) celestialType = 'portal';
  else if (/bat|signal|gotham|searchlight/.test(lower)) celestialType = 'bat-beacon';
  else if (/twin moon|dune/.test(lower)) celestialType = 'twin-moons';
  else if (isCosmic) celestialType = rng() > 0.5 ? 'nebula' : 'planet-limb';
  else if (/dawn|sunset|gold|solar|sun/.test(lower)) celestialType = 'sunburst';

  let silhouetteType: SilhouetteType = 'lone-warrior';
  if (/cape|batman|gotham|vigilante|knight/.test(lower)) silhouetteType = 'caped-vigilante';
  else if (isCyber) silhouetteType = 'netrunner';
  else if (/wizard|mage|magic|spell|potter/.test(lower)) silhouetteType = 'mage-staff';
  else if (/fly|hero|super|marvel|iron/.test(lower)) silhouetteType = 'flying-hero';
  else if (isOcean || /viking/.test(lower)) silhouetteType = 'viking-bow';
  else if (/rift|duality|prime/.test(lower)) silhouetteType = 'dual-rift';

  // Derive vivid graphic-novel palette
  const palette = isCyber
    ? {
        skyTop: '#050816',
        skyMid: '#0f172a',
        skyHorizon: '#0e4c66',
        primaryGlow: '#06b6d4',
        secondaryGlow: '#f43f5e',
        architectureDark: '#060a14',
        architectureLit: '#1e293b',
        rimLight: '#22d3ee',
        fogTint: '#083344',
      }
    : isDesert
    ? {
        skyTop: '#160b07',
        skyMid: '#431407',
        skyHorizon: '#c2410c',
        primaryGlow: '#f97316',
        secondaryGlow: '#fbbf24',
        architectureDark: '#1c0d06',
        architectureLit: '#7c2d12',
        rimLight: '#fdba74',
        fogTint: '#9a3412',
      }
    : isForest
    ? {
        skyTop: '#04120e',
        skyMid: '#062c22',
        skyHorizon: '#065f46',
        primaryGlow: '#10b981',
        secondaryGlow: '#a3e635',
        architectureDark: '#030d0a',
        architectureLit: '#064e3b',
        rimLight: '#6ee7b7',
        fogTint: '#047857',
      }
    : isCosmic
    ? {
        skyTop: '#050517',
        skyMid: '#1e1b4b',
        skyHorizon: '#312e81',
        primaryGlow: '#38bdf8',
        secondaryGlow: '#c084fc',
        architectureDark: '#07061a',
        architectureLit: '#1e1b4b',
        rimLight: '#7dd3fc',
        fogTint: '#4338ca',
      }
    : isFantasy
    ? {
        skyTop: '#090307',
        skyMid: '#2a0812',
        skyHorizon: '#7f1d1d',
        primaryGlow: '#ef4444',
        secondaryGlow: '#f59e0b',
        architectureDark: '#090408',
        architectureLit: '#3f121b',
        rimLight: '#fca5a5',
        fogTint: '#991b1b',
      }
    : {
        skyTop: '#070b14',
        skyMid: '#172036',
        skyHorizon: '#334155',
        primaryGlow: '#eab308',
        secondaryGlow: '#38bdf8',
        architectureDark: '#090d16',
        architectureLit: '#1e293b',
        rimLight: '#fde047',
        fogTint: '#1e3a5f',
      };

  const suggestedEffect: OverlayEffectType =
    /rain|storm|gotham|blade/.test(lower)
      ? 'rain'
      : /snow|ice|winter|frost/.test(lower)
      ? 'snow'
      : /firefl|forest|glade/.test(lower)
      ? 'fireflies'
      : /candle|castle|magic/.test(lower)
      ? 'candles'
      : /portal|rift/.test(lower)
      ? 'portal'
      : /matrix|code|digital/.test(lower)
      ? 'digital-rain'
      : /sand|dune|desert/.test(lower)
      ? 'sandstorm'
      : /ember|fire|dragon|eclipse|lava|berserk/.test(lower)
      ? 'embers'
      : isCyber
      ? 'scanlines'
      : isCosmic
      ? 'aurora-waves'
      : 'stars';

  return {
    themeName: themeName.trim() || 'AI Custom Universe',
    badge: `AI ${AI_ART_STYLES.find((s) => s.id === artStyle)?.label || '4K Master'}`,
    category: 'AI Studio (>4K)',
    suggestedEffect,
    palette,
    celestial: {
      type: celestialType,
      xRatio: 0.42 + (rng() - 0.5) * 0.24,
      yRatio: 0.24 + rng() * 0.14,
      radiusRatio: 0.11 + rng() * 0.06,
    },
    skylineType,
    silhouetteType,
    architectureDensity: 0.65 + rng() * 0.3,
    lightBeams: Math.floor(2 + rng() * 4),
    starDensity: isCosmic ? 0.92 : isCyber ? 0.45 : 0.65,
    rainStreaks: /rain|cyber|gotham|storm/.test(lower) ? 0.85 : 0.15,
    emberGlow: /ember|fire|eclipse|dragon/.test(lower) ? 0.85 : 0.3,
    vignetteStrength: 0.62,
  };
}

export async function generateAiThemeComposition(params: {
  prompt: string;
  themeName: string;
  artStyle: AiArtStyleId;
}): Promise<{ composition: SceneCompositionBlueprint; source: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'offline-engine'; note?: string }> {
  const fallback = buildOfflineSceneComposition(params.prompt, params.themeName, params.artStyle);

  try {
    const response = await fetch(`${getApiBaseOrigin()}/api/gemini/compose-theme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        composition: fallback,
        source: 'offline-engine',
        note: errData?.error || `Rendered with offline painterly engine (HTTP ${response.status}).`,
      };
    }
    const payload = (await response.json()) as {
      composition?: Partial<SceneCompositionBlueprint>;
      model?: string;
    };
    if (!payload.composition || !payload.composition.palette) {
      return { composition: fallback, source: 'offline-engine' };
    }
    const merged: SceneCompositionBlueprint = {
      ...fallback,
      ...payload.composition,
      palette: {
        ...fallback.palette,
        ...(payload.composition.palette || {}),
      },
      celestial: {
        ...fallback.celestial,
        ...(payload.composition.celestial || {}),
      },
      category: 'AI Studio (>4K)',
      themeName: params.themeName.trim() || payload.composition.themeName || fallback.themeName,
    };
    return {
      composition: merged,
      source:
        payload.model === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash',
    };
  } catch {
    return {
      composition: fallback,
      source: 'offline-engine',
      note: 'Server offline — composed artwork locally at full >4K resolution.',
    };
  }
}

/**
 * Renders a multi-pass painterly graphic-novel >4K illustration directly onto an offscreen Canvas
 * at native target resolution (2432x4320, 2880x5120, 4096x4096, or 4320x2432).
 */
export async function renderSceneToOver4KImage(
  blueprint: SceneCompositionBlueprint,
  promptSeed: string,
  resolutionId: AiResolutionPresetId,
  artStyle: AiArtStyleId
): Promise<{ dataUrl: string; width: number; height: number; approxKb: number }> {
  // Yield one animation frame so loading UI renders cleanly before canvas work
  await new Promise((r) => setTimeout(r, 32));

  const preset = AI_RESOLUTION_PRESETS[resolutionId] || AI_RESOLUTION_PRESETS['portrait-4k'];
  const W = preset.width;
  const H = preset.height;
  const S = Math.min(W, H) / 1000; // Relative scale unit so linework & detail remain sharp at 4K+

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable on this device.');
  }

  const rng = createSeededRng(`${blueprint.themeName}|${promptSeed}|${artStyle}|${W}x${H}`);
  const { palette, celestial } = blueprint;

  // PASS 1: Atmospheric Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.78);
  skyGrad.addColorStop(0, palette.skyTop);
  skyGrad.addColorStop(0.55, palette.skyMid);
  skyGrad.addColorStop(1, palette.skyHorizon);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Dual-rift cosmic contrast split if selected
  if (blueprint.silhouetteType === 'dual-rift' || artStyle === 'cosmic-myth') {
    const leftWarm = ctx.createRadialGradient(W * 0.25, H * 0.35, 0, W * 0.25, H * 0.35, W * 0.85);
    leftWarm.addColorStop(0, hexToRgba(palette.secondaryGlow, 0.28));
    leftWarm.addColorStop(1, 'transparent');
    ctx.fillStyle = leftWarm;
    ctx.fillRect(0, 0, W, H);
  }

  // PASS 2: Nebula Clouds & Cosmic Wash
  for (let i = 0; i < 8; i++) {
    const nx = rng() * W;
    const ny = rng() * H * 0.65;
    const nr = (280 + rng() * 520) * S;
    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
    const col = i % 2 === 0 ? palette.primaryGlow : palette.secondaryGlow;
    g.addColorStop(0, hexToRgba(col, 0.14 + rng() * 0.14));
    g.addColorStop(0.5, hexToRgba(col, 0.05));
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // PASS 3: Starfield
  const starCount = Math.floor(260 * Math.max(0.2, blueprint.starDensity));
  for (let i = 0; i < starCount; i++) {
    const sx = rng() * W;
    const sy = rng() * H * 0.68;
    const sr = (0.7 + rng() * 2.2) * S;
    ctx.fillStyle =
      i % 9 === 0
        ? hexToRgba(palette.rimLight, 0.85)
        : `rgba(255,255,255,${0.25 + rng() * 0.7})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // PASS 4: Celestial Centerpiece
  const cx = Math.max(W * 0.2, Math.min(W * 0.8, celestial.xRatio * W));
  const cy = Math.max(H * 0.16, Math.min(H * 0.45, celestial.yRatio * H));
  const cr = Math.max(95, Math.min(W * 0.24, celestial.radiusRatio * Math.min(W, H)));

  // Celestial Halo Bloom
  const halo = ctx.createRadialGradient(cx, cy, cr * 0.3, cx, cy, cr * 4.2);
  halo.addColorStop(0, hexToRgba(palette.primaryGlow, 0.72));
  halo.addColorStop(0.32, hexToRgba(palette.secondaryGlow, 0.28));
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  if (celestial.type === 'eclipse') {
    // Glowing Crimson/Gold Corona + Pitch Black Eclipse Core
    ctx.save();
    ctx.strokeStyle = palette.rimLight;
    ctx.lineWidth = 10 * S;
    ctx.shadowColor = palette.primaryGlow;
    ctx.shadowBlur = 45 * S;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#050208';
    ctx.beginPath();
    ctx.arc(cx, cy, cr * 0.94, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (celestial.type === 'portal') {
    // Swirling Energy Vortex Rings
    ctx.save();
    for (let r = 5; r >= 1; r--) {
      ctx.strokeStyle = hexToRgba(r % 2 === 0 ? palette.primaryGlow : palette.secondaryGlow, 0.55);
      ctx.lineWidth = (3 + r * 2.5) * S;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cr * (0.4 + r * 0.24), cr * (0.28 + r * 0.18), -0.25, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  } else if (celestial.type === 'bat-beacon') {
    // Searchlight cone up from skyline to cloud disc
    const cone = ctx.createLinearGradient(cx, cy, W * 0.48, H * 0.76);
    cone.addColorStop(0, hexToRgba(palette.rimLight, 0.36));
    cone.addColorStop(1, 'transparent');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(cx - cr * 0.9, cy);
    ctx.lineTo(cx + cr * 0.9, cy);
    ctx.lineTo(W * 0.53, H * 0.78);
    ctx.lineTo(W * 0.43, H * 0.78);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = hexToRgba(palette.rimLight, 0.78);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cr * 1.05, cr * 0.85, -0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (celestial.type === 'twin-moons') {
    const moonGrad = ctx.createRadialGradient(cx - cr * 0.25, cy - cr * 0.2, cr * 0.1, cx, cy, cr);
    moonGrad.addColorStop(0, palette.rimLight);
    moonGrad.addColorStop(0.7, palette.secondaryGlow);
    moonGrad.addColorStop(1, hexToRgba(palette.skyHorizon, 0.9));
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hexToRgba(palette.rimLight, 0.85);
    ctx.beginPath();
    ctx.arc(cx + cr * 1.45, cy - cr * 0.55, cr * 0.38, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Dramatic Giant Full Moon / Planet Limb / Sunburst
    const planetGrad = ctx.createRadialGradient(
      cx - cr * 0.3,
      cy - cr * 0.3,
      cr * 0.08,
      cx,
      cy,
      cr
    );
    planetGrad.addColorStop(0, '#ffffff');
    planetGrad.addColorStop(0.28, palette.rimLight);
    planetGrad.addColorStop(0.85, palette.primaryGlow);
    planetGrad.addColorStop(1, hexToRgba(palette.skyMid, 0.95));
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }

  // PASS 5: Dramatic Volumetric Light Beams
  const beams = Math.max(0, Math.min(6, Math.round(blueprint.lightBeams)));
  for (let b = 0; b < beams; b++) {
    const angleOffset = (b - (beams - 1) / 2) * 0.26;
    const beamGrad = ctx.createLinearGradient(cx, cy, cx + angleOffset * W * 0.9, H * 0.85);
    beamGrad.addColorStop(0, hexToRgba(palette.rimLight, 0.18));
    beamGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 24 * S, cy);
    ctx.lineTo(cx + 24 * S, cy);
    ctx.lineTo(cx + angleOffset * W + 190 * S, H * 0.88);
    ctx.lineTo(cx + angleOffset * W - 190 * S, H * 0.88);
    ctx.closePath();
    ctx.fill();
  }

  // PASS 6: Painterly Cloud Banks (Oil Brush Arcs)
  for (let i = 0; i < 42; i++) {
    const clX = rng() * W;
    const clY = H * (0.28 + rng() * 0.34);
    const clW = (180 + rng() * 380) * S;
    const clH = (45 + rng() * 90) * S;
    const clGrad = ctx.createRadialGradient(clX, clY - clH * 0.2, clW * 0.1, clX, clY, clW * 0.65);
    clGrad.addColorStop(0, hexToRgba(palette.rimLight, 0.14 + rng() * 0.12));
    clGrad.addColorStop(0.55, hexToRgba(palette.fogTint, 0.28));
    clGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = clGrad;
    ctx.beginPath();
    ctx.ellipse(clX, clY, clW * 0.6, clH * 0.6, (rng() - 0.5) * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // PASS 7: Distant Mountain / Ridge Layer
  const horizonY = H * 0.72;
  ctx.fillStyle = palette.architectureLit;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, horizonY - 60 * S);
  const segs = 18;
  for (let i = 0; i <= segs; i++) {
    const px = (i / segs) * W;
    const py = horizonY - (30 + rng() * 140) * S;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();

  // PASS 8: Hero Architecture / Skyline / Biome Pass
  const skylineBottom = H * 0.76;
  const drawComicOutline = (lw = 2.6 * S) => {
    ctx.strokeStyle = '#03050a';
    ctx.lineWidth = lw;
    ctx.stroke();
  };

  if (blueprint.skylineType === 'desert-dunes') {
    for (let layer = 0; layer < 4; layer++) {
      const baseY = horizonY - (2 - layer) * 65 * S;
      ctx.fillStyle = layer % 2 === 0 ? palette.architectureLit : palette.architectureDark;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, baseY);
      ctx.bezierCurveTo(
        W * 0.28,
        baseY - 95 * S * (rng() + 0.5),
        W * 0.62,
        baseY + 80 * S,
        W,
        baseY - 40 * S
      );
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexToRgba(palette.rimLight, 0.45);
      ctx.lineWidth = 3 * S;
      ctx.stroke();
    }
  } else if (blueprint.skylineType === 'ancient-forest') {
    const treeCount = 26;
    for (let t = 0; t < treeCount; t++) {
      const tx = (t / (treeCount - 1)) * W + (rng() - 0.5) * 40 * S;
      const trunkW = (28 + rng() * 52) * S;
      const topY = H * (0.08 + rng() * 0.28);
      ctx.fillStyle = palette.architectureDark;
      ctx.beginPath();
      ctx.moveTo(tx - trunkW * 0.7, skylineBottom + 40 * S);
      ctx.lineTo(tx - trunkW * 0.28, topY);
      ctx.lineTo(tx + trunkW * 0.28, topY);
      ctx.lineTo(tx + trunkW * 0.7, skylineBottom + 40 * S);
      ctx.closePath();
      ctx.fill();
      drawComicOutline(2.4 * S);
      // Foliage crown wash
      ctx.fillStyle = hexToRgba(palette.architectureLit, 0.65);
      ctx.beginPath();
      ctx.arc(tx, topY + 50 * S, trunkW * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Towering Gothic Spires / Cyberpunk Towers / Castle Cliff / Ruined Cathedral
    const buildingCount = Math.floor(14 + blueprint.architectureDensity * 14);
    for (let b = 0; b < buildingCount; b++) {
      const bw = (48 + rng() * 110) * S;
      const bh = (160 + rng() * (blueprint.skylineType === 'cyberpunk-towers' ? 560 : 420)) * S;
      const bx = (b / buildingCount) * W - bw * 0.3 + (rng() - 0.5) * 35 * S;
      const by = skylineBottom - bh;

      ctx.fillStyle = b % 3 === 0 ? palette.architectureLit : palette.architectureDark;
      ctx.fillRect(bx, by, bw, bh + 30 * S);

      // Spire / Roof Silhouette
      if (
        blueprint.skylineType === 'gothic-spires' ||
        blueprint.skylineType === 'castle-cliff' ||
        blueprint.skylineType === 'ruined-cathedral'
      ) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + bw * 0.5, by - (35 + rng() * 90) * S);
        ctx.lineTo(bx + bw, by);
        ctx.closePath();
        ctx.fill();
      } else {
        // Cyberpunk antenna & stepped crown
        ctx.fillRect(bx + bw * 0.2, by - 22 * S, bw * 0.6, 22 * S);
        ctx.fillRect(bx + bw * 0.48, by - 85 * S, 4 * S, 65 * S);
      }

      // Comic Rim Highlight Edge
      ctx.fillStyle = hexToRgba(palette.rimLight, 0.35);
      ctx.fillRect(bx, by, 3.5 * S, bh);

      // Illuminated Windows / Neon Signs
      const rows = Math.floor(bh / (24 * S));
      const cols = Math.max(2, Math.floor(bw / (18 * S)));
      for (let r = 1; r < rows; r++) {
        if (rng() > 0.65) continue;
        for (let c = 0; c < cols; c++) {
          if (rng() > 0.52) continue;
          const winColor =
            blueprint.skylineType === 'cyberpunk-towers' && rng() > 0.45
              ? c % 2 === 0
                ? palette.primaryGlow
                : palette.secondaryGlow
              : palette.rimLight;
          ctx.fillStyle = hexToRgba(winColor, 0.35 + rng() * 0.5);
          ctx.fillRect(
            bx + 8 * S + c * ((bw - 14 * S) / cols),
            by + r * 22 * S,
            5.5 * S,
            9 * S
          );
        }
      }

      ctx.strokeStyle = '#03050a';
      ctx.lineWidth = 2.5 * S;
      ctx.strokeRect(bx, by, bw, bh);
    }
  }

  // PASS 9: Atmospheric Horizon Mist & Reflective Foreground Plane
  const fogGrad = ctx.createLinearGradient(0, skylineBottom - 160 * S, 0, skylineBottom + 140 * S);
  fogGrad.addColorStop(0, 'transparent');
  fogGrad.addColorStop(0.5, hexToRgba(palette.fogTint, 0.55));
  fogGrad.addColorStop(1, palette.architectureDark);
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, skylineBottom - 160 * S, W, 320 * S);

  // Foreground water / wet rooftop / floor mirror surface
  const groundGrad = ctx.createLinearGradient(0, skylineBottom, 0, H);
  groundGrad.addColorStop(0, palette.architectureDark);
  groundGrad.addColorStop(0.4, '#050810');
  groundGrad.addColorStop(1, '#020408');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, skylineBottom, W, H - skylineBottom);

  // Shimmering Light Reflection Columns on Ground/Water
  for (let r = 0; r < 24; r++) {
    const ry = skylineBottom + (r / 24) * (H - skylineBottom);
    const rw = (90 + (24 - r) * 14) * S;
    ctx.fillStyle = hexToRgba(r % 2 === 0 ? palette.primaryGlow : palette.rimLight, 0.08 + rng() * 0.1);
    ctx.fillRect(cx - rw * 0.5 + (rng() - 0.5) * 45 * S, ry, rw, 5 * S);
  }

  // PASS 10: Foreground Heroic Rim-Lit Silhouette
  if (blueprint.silhouetteType !== 'none') {
    const hx = W * 0.5;
    const hy = H * 0.84;
    ctx.save();
    ctx.fillStyle = '#030509';
    ctx.strokeStyle = palette.rimLight;
    ctx.lineWidth = 3.5 * S;

    // Ledge / cliff pedestal
    ctx.beginPath();
    ctx.moveTo(hx - 280 * S, H);
    ctx.lineTo(hx - 140 * S, hy);
    ctx.lineTo(hx + 140 * S, hy);
    ctx.lineTo(hx + 280 * S, H);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Figure torso & head
    const figH = 195 * S;
    ctx.beginPath();
    ctx.arc(hx, hy - figH + 22 * S, 18 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cloak / Cape / Coat sweep
    ctx.beginPath();
    ctx.moveTo(hx - 24 * S, hy - figH + 42 * S);
    if (blueprint.silhouetteType === 'caped-vigilante' || blueprint.silhouetteType === 'mage-staff') {
      ctx.quadraticCurveTo(hx - 125 * S, hy - figH * 0.45, hx - 95 * S, hy + 8 * S);
    } else {
      ctx.lineTo(hx - 38 * S, hy);
    }
    ctx.lineTo(hx + 45 * S, hy);
    ctx.quadraticCurveTo(hx + 95 * S, hy - figH * 0.55, hx + 26 * S, hy - figH + 42 * S);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Optional iconic weapon/prop accent
    if (blueprint.silhouetteType === 'lone-warrior') {
      ctx.beginPath();
      ctx.moveTo(hx + 28 * S, hy - figH * 0.5);
      ctx.lineTo(hx + 115 * S, hy - figH * 1.15);
      ctx.lineWidth = 9 * S;
      ctx.stroke();
    } else if (blueprint.silhouetteType === 'mage-staff') {
      ctx.beginPath();
      ctx.moveTo(hx - 48 * S, hy);
      ctx.lineTo(hx - 62 * S, hy - figH * 1.12);
      ctx.lineWidth = 6 * S;
      ctx.stroke();
      ctx.fillStyle = palette.primaryGlow;
      ctx.beginPath();
      ctx.arc(hx - 62 * S, hy - figH * 1.15, 14 * S, 0, Math.PI * 2);
      ctx.fill();
    } else if (blueprint.silhouetteType === 'dual-rift') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5 * S;
      ctx.beginPath();
      ctx.moveTo(hx, 0);
      ctx.lineTo(hx, H);
      ctx.stroke();
    }
    ctx.restore();
  }

  // PASS 11: Rain / Embers / Graphic Novel Ink Crosshatch pass
  if (blueprint.rainStreaks > 0.35) {
    ctx.strokeStyle = hexToRgba(palette.rimLight, 0.22);
    ctx.lineWidth = 1.6 * S;
    const drops = Math.floor(240 * blueprint.rainStreaks);
    for (let i = 0; i < drops; i++) {
      const rx = rng() * W;
      const ry = rng() * H;
      const rl = (45 + rng() * 90) * S;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 14 * S, ry + rl);
      ctx.stroke();
    }
  }

  if (blueprint.emberGlow > 0.35) {
    const emberCount = Math.floor(110 * blueprint.emberGlow);
    for (let i = 0; i < emberCount; i++) {
      const ex = rng() * W;
      const ey = H * (0.2 + rng() * 0.78);
      const er = (2 + rng() * 5) * S;
      ctx.fillStyle = hexToRgba(i % 2 === 0 ? palette.primaryGlow : palette.secondaryGlow, 0.65);
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Heavy comic-book ink border & subtle top/bottom dark vignette for Prime One text legibility
  const topVig = ctx.createLinearGradient(0, 0, 0, H * 0.25);
  topVig.addColorStop(0, `rgba(4, 7, 14, ${Math.min(0.85, blueprint.vignetteStrength)})`);
  topVig.addColorStop(1, 'transparent');
  ctx.fillStyle = topVig;
  ctx.fillRect(0, 0, W, H * 0.25);

  const botVig = ctx.createLinearGradient(0, H * 0.68, 0, H);
  botVig.addColorStop(0, 'transparent');
  botVig.addColorStop(1, `rgba(4, 7, 14, ${Math.min(0.92, blueprint.vignetteStrength + 0.12)})`);
  ctx.fillStyle = botVig;
  ctx.fillRect(0, H * 0.68, W, H * 0.32);

  // Subtle Comic Ink Frame Edge
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 10 * S;
  ctx.strokeRect(5 * S, 5 * S, W - 10 * S, H - 10 * S);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
  const approxKb = Math.round((dataUrl.length * 3) / 4 / 1024);

  return { dataUrl, width: W, height: H, approxKb };
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
