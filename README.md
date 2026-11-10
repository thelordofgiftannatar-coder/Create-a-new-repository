# Prime One — Android & Cloud Hi-Fi Music Player

Prime One is a mobile-first Hi-Fi music player with local folder scanning, static audio waveforms, ID3 tag & artwork editing (including Google Photos), Google Drive cloud storage & cross-device sync, a 5-band Equalizer, >4K universe & AI custom themes, DIY UI styling, and a real-time Voice & Chat companion.

---

## Uploading to GitHub & Building the Android APK

`Prime-One-GitHub-App.zip` is packaged with **90 files (under GitHub's 100-file web upload limit)** and includes **Capacitor Android**, **Android permissions**, **custom launcher/splash artwork** (`public/pwa-512x512.png` & `public/app-cover.png`), and `.github/workflows/build-android-apk.yml`:

1. **Create a new empty repository** on GitHub (e.g., `prime-one-music-player`).
2. **Unzip `Prime-One-GitHub-App.zip`** on your computer, open **inside** the extracted folder, enable **Show hidden files** (so `.github` is selected too), select all (`Ctrl+A` / `Cmd+A`), and drag them into GitHub's **Add file → Upload files** page — then click **Commit changes**.
3. Open your repository's **Actions** tab → select **Build Prime One Android APK** → click **Run workflow** (or wait for the automatic push run).
4. When complete, download **`prime-one-debug-apk`** from **Artifacts**, unzip `app-debug.apk`, and install it on your Android phone.

### Android Config Included
- **App ID / Name**: `com.primeone.musicplayer` / `Prime One` (`capacitor.config.json`)
- **Permissions & Media Art**: `android-config/apply-android-config.mjs` automatically patches `AndroidManifest.xml` (`READ_MEDIA_AUDIO`, `READ_MEDIA_IMAGES`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `POST_NOTIFICATIONS`, `WAKE_LOCK`, `BLUETOOTH_CONNECT`, `audio/*` intent-filter) and generates all Android mipmap icons and splash cover directly from `public/pwa-512x512.png` and `public/app-cover.png`.
- **Direct Phone Install (No GitHub Required)**: Open the live Prime One URL in **Chrome (Android)** or **Safari (iPhone)** and tap **Get App → Install app / Add to Home Screen**.

---

## Running Full-Stack Locally / Deploying Web Server

```bash
npm install
npm run build
npm start
```

Environment variables:
- `GEMINI_API_KEY`: Enables `/api/gemini/chat`, `/api/gemini/compose-theme`, and `/api/gemini/live`.
- `VITE_API_BASE_URL` *(optional for standalone Android APK)*: Points an offline Capacitor APK to a deployed Prime One API server URL.
