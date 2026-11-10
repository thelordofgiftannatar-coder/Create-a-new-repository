import React, { useMemo } from 'react';
import {
  CustomThemeRecord,
  DEFAULT_DIY_STYLE,
  LandscapeThemeConfig,
  LANDSCAPE_THEMES,
} from '../types/themeLandscape';
import { AtmosphericOverlay } from './AtmosphericOverlay';

interface WallpaperBackgroundProps {
  config: LandscapeThemeConfig;
  customThemes?: CustomThemeRecord[];
  currentTrackCover?: string;
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
  if (Number.isNaN(num)) return `rgba(7, 11, 20, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export const WallpaperBackground: React.FC<WallpaperBackgroundProps> = ({
  config,
  customThemes = [],
  currentTrackCover,
}) => {
  const diy = useMemo(() => ({ ...DEFAULT_DIY_STYLE, ...(config.diyStyle || {}) }), [config.diyStyle]);

  const currentTheme = useMemo(() => {
    const allThemes = [...customThemes, ...LANDSCAPE_THEMES];
    return allThemes.find((t) => t.id === config.activeThemeId) || LANDSCAPE_THEMES[0];
  }, [customThemes, config.activeThemeId]);

  const mediaInfo = useMemo(() => {
    if (config.useAlbumArtFallback && currentTrackCover) {
      return {
        mediaType: 'image' as const,
        url: currentTrackCover,
      };
    }

    const customOverride = config.themeWallpapers[config.activeThemeId];
    if (customOverride && customOverride.url) {
      return customOverride;
    }

    return {
      mediaType: 'image' as const,
      url: currentTheme.defaultWallpaper,
    };
  }, [
    config.useAlbumArtFallback,
    currentTrackCover,
    config.themeWallpapers,
    config.activeThemeId,
    currentTheme.defaultWallpaper,
  ]);

  const effectivePrimaryHex = diy.customPrimaryHex || currentTheme.accentHex;
  const effectiveSecondaryHex = diy.customSecondaryHex || '#8b5cf6';
  const surfaceBaseHex =
    diy.customSurfaceHex || (diy.screenStyle === 'amoled-black' ? '#000000' : '#070b14');

  const resolvedOverlayEffect =
    diy.overlayEffectOverride && diy.overlayEffectOverride !== 'theme-default'
      ? diy.overlayEffectOverride
      : currentTheme.overlayEffect;

  const glowOpacity = Math.max(0, Math.min(0.65, diy.glowIntensity * 0.55));

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
      {mediaInfo.mediaType === 'video' ? (
        <video
          key={mediaInfo.url}
          src={mediaInfo.url}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out transform scale-105"
          style={{
            filter: `blur(${config.blur}px)`,
          }}
        />
      ) : (
        <img
          key={mediaInfo.url}
          src={mediaInfo.url}
          alt={currentTheme.name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out transform scale-105"
          style={{
            filter: `blur(${config.blur}px)`,
          }}
        />
      )}

      {/* Dim Overlay with optional DIY Surface Tint */}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          backgroundColor: hexToRgba(surfaceBaseHex, config.dim),
        }}
      />

      {/* Animated Atmospheric Effects with DIY Override & Intensity */}
      <AtmosphericOverlay
        effect={resolvedOverlayEffect}
        enabled={config.enableAtmosphericEffects}
        intensity={diy.effectIntensity}
        accentHex={effectivePrimaryHex}
        secondaryHex={effectiveSecondaryHex}
      />

      {/* Extra Top & Bottom Dark Vignette */}
      {config.extraVignette && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-44 pointer-events-none"
            style={{
              background: `linear-gradient(to bottom, ${hexToRgba(surfaceBaseHex, 0.92)}, ${hexToRgba(surfaceBaseHex, 0.4)} 55%, transparent)`,
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
            style={{
              background: `linear-gradient(to top, ${hexToRgba(surfaceBaseHex, 0.95)}, ${hexToRgba(surfaceBaseHex, 0.5)} 55%, transparent)`,
            }}
          />
        </>
      )}

      {/* Ambient radial glow controlled by DIY Glow Bloom + Primary/Secondary Hex */}
      {glowOpacity > 0.01 && (
        <div
          className="absolute inset-0 pointer-events-none mix-blend-screen transition-opacity duration-500"
          style={{
            opacity: glowOpacity,
            background: `radial-gradient(circle at 50% 28%, ${effectivePrimaryHex}, transparent 58%), radial-gradient(circle at 80% 78%, ${effectiveSecondaryHex}, transparent 55%)`,
          }}
        />
      )}
    </div>
  );
};
