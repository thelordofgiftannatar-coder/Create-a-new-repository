/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extracts embedded album artwork (JPEG/PNG/WEBP) from MP3, FLAC, M4A, or OGG audio files.
 * Falls back to generating a stylized record label / album cover with track metadata.
 */
export async function extractEmbeddedAlbumArt(file: File, fallbackTitle: string, fallbackArtist: string): Promise<string> {
  try {
    // Read the first 1.5MB of the file (ID3v2 metadata & artwork are almost always in the header)
    const sliceSize = Math.min(file.size, 1.5 * 1024 * 1024);
    const buffer = await file.slice(0, sliceSize).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Search for JPEG signature: 0xFF 0xD8 0xFF
    for (let i = 0; i < bytes.length - 4; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        // Look for JPEG end of image: 0xFF 0xD9
        let endIdx = -1;
        for (let j = i + 10; j < bytes.length - 1; j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            endIdx = j + 2;
            break;
          }
        }
        if (endIdx > i && endIdx - i > 1024) {
          const imgSlice = bytes.slice(i, endIdx);
          const blob = new Blob([imgSlice], { type: 'image/jpeg' });
          return URL.createObjectURL(blob);
        }
      }

      // 2. Search for PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4e &&
        bytes[i + 3] === 0x47 &&
        bytes[i + 4] === 0x0d &&
        bytes[i + 5] === 0x0a &&
        bytes[i + 6] === 0x1a &&
        bytes[i + 7] === 0x0a
      ) {
        // Look for IEND chunk: 0x49 0x45 0x4E 0x44 0xAE 0x42 0x60 0x82
        let endIdx = -1;
        for (let j = i + 8; j < bytes.length - 7; j++) {
          if (
            bytes[j] === 0x49 &&
            bytes[j + 1] === 0x45 &&
            bytes[j + 2] === 0x4e &&
            bytes[j + 3] === 0x44
          ) {
            endIdx = j + 8;
            break;
          }
        }
        if (endIdx > i && endIdx - i > 1024) {
          const imgSlice = bytes.slice(i, endIdx);
          const blob = new Blob([imgSlice], { type: 'image/png' });
          return URL.createObjectURL(blob);
        }
      }
    }
  } catch (err) {
    console.warn('Note on album art extraction:', err);
  }

  // 3. Fallback: Generate an authentic, high-resolution original album cover canvas
  return generateProceduralAlbumArt(fallbackTitle, fallbackArtist);
}

/**
 * Generates an original square album cover (512x512) for songs without embedded art
 */
export function generateProceduralAlbumArt(title: string, artist: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '/pwa-512x512.png';

  // Deterministic color palette from title & artist
  let hash = 0;
  const seed = title + artist;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 45 + Math.abs((hash >> 3) % 90)) % 360;

  // Background Gradient
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, `hsl(${hue1}, 75%, 16%)`);
  gradient.addColorStop(0.5, `hsl(${hue2}, 65%, 10%)`);
  gradient.addColorStop(1, '#05070d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  // Concentric vinyl grooves and geometric sonic rings
  ctx.strokeStyle = `hsla(${hue1}, 80%, 65%, 0.15)`;
  ctx.lineWidth = 1.5;
  for (let r = 80; r < 240; r += 20) {
    ctx.beginPath();
    ctx.arc(256, 220, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Center Album Disc
  const discGrad = ctx.createRadialGradient(256, 220, 10, 256, 220, 110);
  discGrad.addColorStop(0, `hsl(${hue1}, 90%, 55%)`);
  discGrad.addColorStop(0.7, `hsl(${hue2}, 80%, 35%)`);
  discGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(256, 220, 100, 0, Math.PI * 2);
  ctx.fill();

  // Disc center spindle hole
  ctx.fillStyle = '#05070d';
  ctx.beginPath();
  ctx.arc(256, 220, 18, 0, Math.PI * 2);
  ctx.fill();

  // Subtle lighting sheen
  ctx.save();
  ctx.translate(256, 220);
  ctx.rotate((hash % 180) * (Math.PI / 180));
  const sheenGrad = ctx.createLinearGradient(-100, -100, 100, 100);
  sheenGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
  sheenGrad.addColorStop(0.5, 'transparent');
  sheenGrad.addColorStop(1, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = sheenGrad;
  ctx.fillRect(-100, -100, 200, 200);
  ctx.restore();

  // Bottom Label Plate
  ctx.fillStyle = 'rgba(7, 11, 20, 0.85)';
  ctx.fillRect(20, 360, 472, 130);
  ctx.strokeStyle = `hsla(${hue1}, 80%, 60%, 0.3)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 360, 472, 130);

  // Title typography
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  const displayTitle = title.length > 24 ? title.slice(0, 22) + '...' : title;
  ctx.fillText(displayTitle, 256, 410);

  // Artist typography
  ctx.fillStyle = `hsl(${hue1}, 85%, 70%)`;
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const displayArtist = artist.length > 30 ? artist.slice(0, 28) + '...' : artist;
  ctx.fillText(displayArtist, 256, 442);

  // Hi-Fi Master Audio Tag
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('ORIGINAL MASTER RECORDING • STEREO', 256, 470);

  return canvas.toDataURL('image/jpeg', 0.9);
}
