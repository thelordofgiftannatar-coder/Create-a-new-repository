import { Track } from '../types/music';
import midnightLofiCover from '../assets/images/album_cover_midnight_lofi_1794252385108.jpg';
import cyberHighwayCover from '../assets/images/album_cover_cyber_highway_1794252386024.jpg';
import clairDeLuneCover from '../assets/images/album_cover_clair_de_lune_1794252386594.jpg';
import solarWindsCover from '../assets/images/album_cover_solar_winds_1794252387764.jpg';
import gymBeatsCover from '../assets/images/album_cover_gym_beats_1794252388286.jpg';

// Helper to generate a realistic audio density waveform (normalized between 0.15 and 0.98)
export function generateRealisticWaveform(seed: string, barCount = 36): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const bars: number[] = [];
  const freq1 = 1.8 + Math.abs((hash % 7) * 0.3);
  const freq2 = 4.2 + Math.abs(((hash >> 3) % 9) * 0.4);

  for (let i = 0; i < barCount; i++) {
    const t = i / (barCount - 1);
    const envelope = Math.sin(t * Math.PI) * 0.65 + 0.35;
    const wave1 = Math.sin(t * Math.PI * freq1);
    const wave2 = Math.cos(t * Math.PI * freq2) * 0.4;
    const noise = (((hash * (i + 13)) % 100) / 100 - 0.5) * 0.25;

    let amp = (0.5 + wave1 * 0.3 + wave2 * 0.2 + noise) * envelope;
    amp = Math.max(0.12, Math.min(0.98, amp));
    bars.push(Number(amp.toFixed(3)));
  }
  return bars;
}

// Curated royalty-free, high-quality audio tracks with original cover art, folder paths, year tags, and density waveforms
export const INITIAL_TRACKS: Track[] = [
  {
    id: 'demo-1',
    title: 'Midnight Lo-Fi Echoes',
    artist: 'Aetheric Dream',
    album: 'Neon Memories',
    duration: 185,
    genre: 'Lo-Fi / Chill',
    year: '2024',
    trackNumber: 1,
    folderPath: 'Internal Storage/Download',
    playCount: 3,
    source: 'curated',
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 3,
    coverUrl: midnightLofiCover,
    url: 'https://cdn.freesound.org/previews/655/655452_11861866-lq.mp3',
    lyrics: `[00:04.00] Soft rain against the neon window
[00:12.50] Distant traffic humming through the dark
[00:20.00] Coffee steam and wandering thoughts
[00:28.00] Floating between dreaming and awakening
[00:36.50] Synths like distant stars in twilight
[00:48.00] Let the rhythm ease the restless mind
[01:02.00] Time slows down in the quiet hours
[01:18.00] Rest your head, the night is yours...`,
    isFavorite: true,
    waveform: [
      0.18, 0.25, 0.38, 0.45, 0.52, 0.61, 0.58, 0.65, 0.72, 0.68,
      0.75, 0.82, 0.78, 0.64, 0.58, 0.72, 0.85, 0.89, 0.76, 0.68,
      0.82, 0.79, 0.71, 0.65, 0.58, 0.67, 0.74, 0.71, 0.62, 0.54,
      0.48, 0.42, 0.35, 0.28, 0.22, 0.15,
    ],
  },
  {
    id: 'demo-2',
    title: 'Cyber Highway 2088',
    artist: 'SynthWave Rider',
    album: 'Retro Pulse Vol. 1',
    duration: 142,
    genre: 'Synthwave / Retro',
    year: '2025',
    trackNumber: 2,
    folderPath: 'Internal Storage/Synthwave',
    playCount: 1,
    source: 'curated',
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 2,
    coverUrl: cyberHighwayCover,
    url: 'https://cdn.freesound.org/previews/612/612095_5674468-lq.mp3',
    lyrics: `[00:02.00] Headlights piercing through the purple haze
[00:14.00] Digital horizon glowing in the dash
[00:24.00] 120 beats per minute on the asphalt
[00:34.00] Chasing the chrome silhouette
[00:46.00] Accelerate into the future
[00:58.00] Electric heart, bassline in the veins!
[01:10.00] Never looking back tonight`,
    isFavorite: false,
    waveform: [
      0.35, 0.48, 0.62, 0.78, 0.88, 0.92, 0.85, 0.94, 0.96, 0.88,
      0.92, 0.95, 0.91, 0.62, 0.45, 0.75, 0.89, 0.98, 0.95, 0.92,
      0.88, 0.94, 0.96, 0.92, 0.85, 0.91, 0.95, 0.89, 0.82, 0.74,
      0.68, 0.58, 0.48, 0.38, 0.29, 0.20,
    ],
  },
  {
    id: 'demo-3',
    title: 'Clair de Lune (Acoustic Ambient)',
    artist: 'Claude Debussy',
    album: 'Classical',
    duration: 215,
    genre: 'Classical / Ambient',
    year: '1905',
    trackNumber: 3,
    folderPath: 'Internal Storage/Classical',
    playCount: 5,
    source: 'curated',
    dateAdded: Date.now() - 1000 * 60 * 60 * 24 * 1,
    coverUrl: clairDeLuneCover,
    url: 'https://upload.wikimedia.org/wikipedia/commons/2/21/Claude_Debussy_-_Clair_de_lune.ogg',
    lyrics: `[00:05.00] Instrumental masterpiece
[00:25.00] Melodic serenity under the moonlight
[00:50.00] Gentle waves of harmony
[01:20.00] Classical tranquility for the soul
[01:45.00] Echoes fading in the evening breeze...`,
    isFavorite: true,
    waveform: [
      0.15, 0.22, 0.18, 0.31, 0.28, 0.42, 0.35, 0.48, 0.55, 0.62,
      0.58, 0.69, 0.78, 0.85, 0.82, 0.72, 0.64, 0.58, 0.68, 0.79,
      0.88, 0.84, 0.75, 0.62, 0.51, 0.44, 0.38, 0.46, 0.39, 0.32,
      0.26, 0.22, 0.19, 0.16, 0.14, 0.12,
    ],
  },
  {
    id: 'demo-4',
    title: 'Solar Winds & Deep Space',
    artist: 'Cosmo Nautica',
    album: 'Interstellar Horizons',
    duration: 168,
    genre: 'Ambient / Electronic',
    year: '2024',
    trackNumber: 4,
    folderPath: 'Internal Storage/instrumental',
    playCount: 0,
    source: 'curated',
    dateAdded: Date.now(),
    coverUrl: solarWindsCover,
    url: 'https://cdn.freesound.org/previews/557/557432_6142149-lq.mp3',
    lyrics: `[00:06.00] Drifting past the rings of Saturn
[00:18.00] Gravitational waves whispering
[00:30.00] Endless cosmic ocean
[00:48.00] Infinite dark, infinite light
[01:05.00] Weightless in the void...`,
    isFavorite: false,
    waveform: [
      0.14, 0.18, 0.24, 0.28, 0.35, 0.42, 0.48, 0.52, 0.58, 0.64,
      0.71, 0.75, 0.78, 0.82, 0.86, 0.84, 0.81, 0.78, 0.74, 0.68,
      0.72, 0.76, 0.79, 0.74, 0.68, 0.62, 0.55, 0.48, 0.42, 0.36,
      0.30, 0.25, 0.21, 0.18, 0.15, 0.12,
    ],
  },
  {
    id: 'demo-5',
    title: 'Gym Beats & Bass Boost',
    artist: 'Voltage Crew',
    album: 'Peak Performance',
    duration: 135,
    genre: 'Bass / EDM',
    year: '2026',
    trackNumber: 5,
    folderPath: 'Internal Storage/Download',
    playCount: 0,
    source: 'curated',
    dateAdded: Date.now(),
    coverUrl: gymBeatsCover,
    url: 'https://cdn.freesound.org/previews/517/517743_11565147-lq.mp3',
    lyrics: `[00:03.00] Drop the beat, pump the energy
[00:15.00] Feel the sub-bass shaking the floor
[00:28.00] Heavy kicks, high tempo!
[00:42.00] Maximum power output!
[00:56.00] Push through every limit!`,
    isFavorite: false,
    waveform: [
      0.45, 0.65, 0.82, 0.95, 0.98, 0.94, 0.96, 0.98, 0.92, 0.95,
      0.99, 0.96, 0.92, 0.68, 0.52, 0.85, 0.96, 1.00, 0.98, 0.95,
      0.97, 0.99, 0.96, 0.94, 0.96, 0.98, 0.95, 0.92, 0.88, 0.82,
      0.76, 0.68, 0.58, 0.46, 0.35, 0.22,
    ],
  },
];
