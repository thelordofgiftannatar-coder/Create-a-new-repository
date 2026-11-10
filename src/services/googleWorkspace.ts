import { Track, Playlist, EqualizerSettings, PrimeOneSettings } from '../types/music';
import { LandscapeThemeConfig } from '../types/themeLandscape';

const DRIVE_FOLDER_NAME = 'Prime One Music';
const DRIVE_BACKUP_FILENAME = 'prime-one-cloud-backup.json';

export interface DriveMediaItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  thumbnailLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface PrimeOneCloudBackup {
  version: number;
  exportedAt: number;
  tracks: Omit<Track, 'fileBlob'>[];
  playlists: Playlist[];
  eqSettings: EqualizerSettings;
  landscapeConfig: LandscapeThemeConfig;
  playerSettings: PrimeOneSettings;
}

function authHeaders(token: string, extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

/**
 * Find or create the dedicated "Prime One Music" folder in user's Google Drive.
 */
export async function ensurePrimeOneDriveFolder(token: string): Promise<string> {
  const q = encodeURIComponent(
    `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive folder query failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id as string;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Prime One cloud audio library and backups',
    }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Could not create Drive folder (${createRes.status}): ${errText}`);
  }
  const created = await createRes.json();
  return created.id as string;
}

/**
 * Upload an audio File/Blob to the user's "Prime One Music" Drive folder.
 */
export async function uploadAudioToDrive(
  token: string,
  blob: Blob,
  fileName: string,
  folderId?: string
): Promise<DriveMediaItem> {
  const targetFolderId = folderId || (await ensurePrimeOneDriveFolder(token));

  const metadata = {
    name: fileName,
    parents: [targetFolderId],
    mimeType: blob.type || 'audio/mpeg',
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob, fileName);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,createdTime',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: form,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive audio upload failed (${res.status}): ${errText}`);
  }

  return (await res.json()) as DriveMediaItem;
}

/**
 * List audio files accessible by Prime One in Google Drive.
 */
export async function listDriveAudioFiles(token: string): Promise<DriveMediaItem[]> {
  const q = encodeURIComponent(
    "trashed = false and (mimeType contains 'audio/' or name contains '.mp3' or name contains '.flac' or name contains '.m4a' or name contains '.wav' or name contains '.ogg')"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,modifiedTime,createdTime)&orderBy=modifiedTime desc&pageSize=100`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to list Drive audio files (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return (data.files || []) as DriveMediaItem[];
}

/**
 * Download an authenticated audio file binary from Google Drive as Blob for offline cache or playback.
 */
export async function downloadDriveFileAsBlob(token: string, fileId: string): Promise<Blob> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) {
    throw new Error(`Failed to download Drive file (${res.status})`);
  }
  return await res.blob();
}

/**
 * Delete a file from Google Drive (call ONLY after explicit user confirmation dialog).
 */
export async function deleteDriveFile(token: string, fileId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete Drive file (${res.status})`);
  }
}

/**
 * Save a full Prime One backup JSON file inside "Prime One Music" folder in Google Drive.
 */
export async function saveBackupToDrive(
  token: string,
  backup: PrimeOneCloudBackup
): Promise<DriveMediaItem> {
  const folderId = await ensurePrimeOneDriveFolder(token);

  // Check if backup file already exists to update it cleanly
  const q = encodeURIComponent(
    `name = '${DRIVE_BACKUP_FILENAME}' and '${folderId}' in parents and trashed = false`
  );
  const existingRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`,
    { headers: authHeaders(token) }
  );
  const existingJson = existingRes.ok ? await existingRes.json() : { files: [] };
  const existingId: string | undefined = existingJson.files?.[0]?.id;

  const jsonBlob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });

  if (existingId) {
    const updateRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=media&fields=id,name,mimeType,size,modifiedTime`,
      {
        method: 'PATCH',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: jsonBlob,
      }
    );
    if (!updateRes.ok) {
      throw new Error(`Backup update failed (${updateRes.status})`);
    }
    return (await updateRes.json()) as DriveMediaItem;
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob(
      [
        JSON.stringify({
          name: DRIVE_BACKUP_FILENAME,
          parents: [folderId],
          mimeType: 'application/json',
        }),
      ],
      { type: 'application/json' }
    )
  );
  form.append('file', jsonBlob, DRIVE_BACKUP_FILENAME);

  const createRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: form,
    }
  );
  if (!createRes.ok) {
    throw new Error(`Backup upload failed (${createRes.status})`);
  }
  return (await createRes.json()) as DriveMediaItem;
}

/**
 * Restore backup JSON from "Prime One Music" folder in Google Drive.
 */
export async function restoreBackupFromDrive(
  token: string
): Promise<PrimeOneCloudBackup | null> {
  const q = encodeURIComponent(`name = '${DRIVE_BACKUP_FILENAME}' and trashed = false`);
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc&pageSize=1`,
    { headers: authHeaders(token) }
  );
  if (!listRes.ok) {
    throw new Error(`Could not locate backup file (${listRes.status})`);
  }
  const listJson = await listRes.json();
  const fileId = listJson.files?.[0]?.id;
  if (!fileId) return null;

  const dlRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: authHeaders(token) }
  );
  if (!dlRes.ok) {
    throw new Error(`Could not download backup file (${dlRes.status})`);
  }
  return (await dlRes.json()) as PrimeOneCloudBackup;
}

/**
 * Fetch image items from Google Photos space & Drive images for the Tag Editor artwork selector.
 */
export async function listGooglePhotosImages(token: string): Promise<DriveMediaItem[]> {
  const combined: DriveMediaItem[] = [];

  // Query Google Photos space via Drive API (drive.photos.readonly scope)
  try {
    const photosRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=photos&fields=files(id,name,mimeType,thumbnailLink,createdTime)&pageSize=40`,
      { headers: authHeaders(token) }
    );
    if (photosRes.ok) {
      const photosData = await photosRes.json();
      if (Array.isArray(photosData.files)) {
        combined.push(...photosData.files);
      }
    }
  } catch (err) {
    console.warn('Google Photos space query note:', err);
  }

  // Also include accessible Drive image files
  try {
    const q = encodeURIComponent("trashed = false and mimeType contains 'image/'");
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,thumbnailLink,createdTime)&orderBy=modifiedTime desc&pageSize=30`,
      { headers: authHeaders(token) }
    );
    if (driveRes.ok) {
      const driveData = await driveRes.json();
      if (Array.isArray(driveData.files)) {
        const seen = new Set(combined.map((f) => f.id));
        driveData.files.forEach((f: DriveMediaItem) => {
          if (!seen.has(f.id)) combined.push(f);
        });
      }
    }
  } catch (err) {
    console.warn('Drive images query note:', err);
  }

  return combined;
}

/**
 * Convert an image Blob or Drive file ID into a square-cropped, Firestore-safe JPEG DataURL (< 120KB).
 */
export async function imageBlobToCompactArtwork(blob: Blob, maxSize = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const imgUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const side = Math.min(maxSize, Math.max(img.width, img.height, 256));
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(imgUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        // Center-crop to square so album cover art looks sharp
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, side, side);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(imgUrl);
        resolve(dataUrl);
      } catch (e) {
        URL.revokeObjectURL(imgUrl);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(imgUrl);
      reject(new Error('Failed to decode selected image'));
    };
    img.src = imgUrl;
  });
}

// Google Picker Loader & Invoker (Client-Side Widget, no developer key per skill pattern)
let gapiLoadPromise: Promise<void> | null = null;

function loadGooglePickerApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  const win = window as unknown as { gapi?: any; google?: any };
  if (win.google?.picker) return Promise.resolve();
  if (gapiLoadPromise) return gapiLoadPromise;

  gapiLoadPromise = new Promise<void>((resolve, reject) => {
    const onGapiReady = () => {
      win.gapi.load('picker', {
        callback: () => resolve(),
        onerror: () => reject(new Error('Failed to initialize Google Picker module')),
      });
    };

    if (win.gapi) {
      onGapiReady();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.onload = onGapiReady;
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.body.appendChild(script);
  });

  return gapiLoadPromise;
}

function getPickerOrigin(): string {
  const ancestors = window.location.ancestorOrigins;
  if (ancestors && ancestors.length > 0) {
    return ancestors[ancestors.length - 1];
  }
  return window.location.origin;
}

export interface PickedGoogleFile {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
}

/**
 * Open Google Picker configured for Google Photos & Drive Images (used in Tag Cover Editor).
 */
export async function openGooglePhotosAndImagesPicker(
  accessToken: string,
  onPicked: (file: PickedGoogleFile) => void
): Promise<void> {
  await loadGooglePickerApi();
  const win = window as unknown as { google: any };
  const google = win.google;

  const docsImageView = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);

  const picker = new google.picker.PickerBuilder()
    .addView(google.picker.ViewId.PHOTOS)
    .addView(google.picker.ViewId.PHOTO_ALBUMS)
    .addView(docsImageView)
    .setOAuthToken(accessToken)
    .setOrigin(getPickerOrigin())
    .setTitle('Choose Song Artwork from Google Photos & Drive')
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED && data.docs?.[0]) {
        const doc = data.docs[0];
        onPicked({
          id: doc.id,
          name: doc.name || 'cover.jpg',
          mimeType: doc.mimeType || 'image/jpeg',
          url: doc.url,
        });
      }
    })
    .build();

  picker.setVisible(true);
}

/**
 * Open Google Picker configured for Google Drive Audio Files & Uploads.
 */
export async function openGoogleDriveAudioPicker(
  accessToken: string,
  onPicked: (files: PickedGoogleFile[]) => void
): Promise<void> {
  await loadGooglePickerApi();
  const win = window as unknown as { google: any };
  const google = win.google;

  const audioDocsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
    .setMimeTypes('audio/mpeg,audio/mp3,audio/mp4,audio/flac,audio/wav,audio/ogg,audio/aac,audio/x-m4a')
    .setIncludeFolders(true);

  const picker = new google.picker.PickerBuilder()
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .addView(audioDocsView)
    .addView(new google.picker.DocsUploadView())
    .setOAuthToken(accessToken)
    .setOrigin(getPickerOrigin())
    .setTitle('Import Audio from Google Drive to Prime One')
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED && Array.isArray(data.docs)) {
        const picked: PickedGoogleFile[] = data.docs.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          mimeType: doc.mimeType || 'audio/mpeg',
          url: doc.url,
        }));
        onPicked(picked);
      }
    })
    .build();

  picker.setVisible(true);
}
