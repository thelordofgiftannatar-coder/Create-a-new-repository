import { Track, EqualizerSettings } from '../types/music';

export interface EQPreset {
  name: string;
  bands: [number, number, number, number, number]; // 60Hz, 250Hz, 1kHz, 4kHz, 12kHz
  bassBoost: number;
  surround: boolean;
}

export const EQ_PRESETS: Record<string, EQPreset> = {
  flat: { name: 'Flat / Normal', bands: [0, 0, 0, 0, 0], bassBoost: 0, surround: false },
  bassBoost: { name: 'Bass Booster', bands: [7, 5, 1, 0, -1], bassBoost: 75, surround: false },
  vocal: { name: 'Vocal Clarity', bands: [-2, 0, 5, 4, 1], bassBoost: 0, surround: false },
  electronic: { name: 'Electronic / EDM', bands: [6, 4, -1, 3, 5], bassBoost: 60, surround: true },
  rock: { name: 'Rock & Metal', bands: [5, 3, -2, 4, 6], bassBoost: 40, surround: true },
  jazz: { name: 'Smooth Jazz', bands: [3, 2, 1, 2, 4], bassBoost: 20, surround: true },
  acoustic: { name: 'Acoustic / Warm', bands: [2, 4, 3, 2, 1], bassBoost: 15, surround: false },
  hiphop: { name: 'Hip-Hop Punch', bands: [8, 6, 0, 2, 3], bassBoost: 80, surround: false },
};

class AudioEngine {
  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // Web Audio Nodes
  private preampGain: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private bassFilter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Spatializer / Surround effect
  private surroundGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;

  // Generative synth nodes
  private synthInterval: number | null = null;
  private synthMasterGain: GainNode | null = null;
  private isSynthPlaying = false;
  private currentAmbientMode: string | null = null;

  // Current playing track & handlers
  public currentTrack: Track | null = null;
  private onTrackEndedCallback: (() => void) | null = null;
  private onPrevCallback: (() => void) | null = null;
  private onNextCallback: (() => void) | null = null;
  private onExternalPauseCallback: (() => void) | null = null;
  private onExternalPlayCallback: (() => void) | null = null;
  private onAudioOutputDisconnected: (() => void) | null = null;
  private lastAudioDeviceCount: number | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';

    this.audio.addEventListener('ended', () => {
      if (this.onTrackEndedCallback) {
        this.onTrackEndedCallback();
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      this.updateMediaSessionPosition();
    });

    this.audio.addEventListener('play', () => {
      this.updateMediaSessionPlaybackState('playing');
      if (this.onExternalPlayCallback) this.onExternalPlayCallback();
    });

    this.audio.addEventListener('pause', () => {
      this.updateMediaSessionPlaybackState('paused');
      if (this.onExternalPauseCallback) this.onExternalPauseCallback();
    });

    // Monitor Bluetooth / Headset disconnects on supported browsers
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioOuts = devices.filter((d) => d.kind === 'audiooutput').length;
          if (this.lastAudioDeviceCount !== null && audioOuts < this.lastAudioDeviceCount) {
            if (this.onAudioOutputDisconnected) {
              this.onAudioOutputDisconnected();
            }
          }
          this.lastAudioDeviceCount = audioOuts;
        } catch {
          // Permission not requested or unsupported
        }
      });
    }
  }

  private initAudioContext(): void {
    if (this.audioCtx) return;

    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1.0;

      this.preampGain = this.audioCtx.createGain();
      this.preampGain.gain.value = 1.0;

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.bassFilter = this.audioCtx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 120;
      this.bassFilter.gain.value = 0;

      const freqs = [60, 250, 1000, 4000, 12000];
      const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

      this.filters = freqs.map((f, i) => {
        const filter = this.audioCtx!.createBiquadFilter();
        filter.type = types[i];
        filter.frequency.value = f;
        filter.gain.value = 0;
        if (types[i] === 'peaking') {
          filter.Q.value = 1.2;
        }
        return filter;
      });

      this.delayNode = this.audioCtx.createDelay();
      this.delayNode.delayTime.value = 0.015;
      this.surroundGain = this.audioCtx.createGain();
      this.surroundGain.gain.value = 0;

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);

      let lastNode: AudioNode = this.sourceNode;
      lastNode.connect(this.preampGain);
      lastNode = this.preampGain;

      for (const filter of this.filters) {
        lastNode.connect(filter);
        lastNode = filter;
      }

      lastNode.connect(this.bassFilter);
      lastNode = this.bassFilter;

      if (this.delayNode && this.surroundGain) {
        lastNode.connect(this.delayNode);
        this.delayNode.connect(this.surroundGain);
        this.surroundGain.connect(this.masterGain);
      }

      lastNode.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio API initialization note:', e);
    }
  }

  public ensureContext(): void {
    this.initAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public async playTrack(track: Track): Promise<void> {
    this.stopSynth();
    this.ensureContext();
    this.currentTrack = track;

    if (track.url && this.audio.src !== track.url) {
      this.audio.src = track.url;
    }

    try {
      await this.audio.play();
      this.setupMediaSession(track);
    } catch (err) {
      console.warn('Playback error / gesture required:', err);
    }
  }

  public async resume(): Promise<void> {
    this.ensureContext();
    if (this.isSynthPlaying) return;
    await this.audio.play();
  }

  public pause(): void {
    if (this.isSynthPlaying) {
      this.stopSynth();
      return;
    }
    this.audio.pause();
  }

  public seek(seconds: number): void {
    if (!Number.isNaN(seconds) && Number.isFinite(seconds)) {
      this.audio.currentTime = Math.max(0, Math.min(seconds, this.audio.duration || 0));
      this.updateMediaSessionPosition();
    }
  }

  public setVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    this.audio.volume = clamped;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
  }

  public setPlaybackRate(rate: number): void {
    this.audio.playbackRate = rate;
    this.updateMediaSessionPosition();
  }

  public getPlaybackRate(): number {
    return this.audio.playbackRate;
  }

  public getCurrentTime(): number {
    return this.audio.currentTime;
  }

  public getDuration(): number {
    return this.audio.duration || this.currentTrack?.duration || 0;
  }

  public isPlaying(): boolean {
    if (this.isSynthPlaying) return true;
    return !this.audio.paused && !this.audio.ended && this.audio.readyState > 2;
  }

  public isPaused(): boolean {
    if (this.isSynthPlaying) return false;
    return this.audio.paused;
  }

  public applyEqualizer(settings: EqualizerSettings): void {
    this.ensureContext();
    if (!this.audioCtx) return;

    const enabled = settings.enabled;

    if (this.preampGain) {
      const preampVal = enabled ? Math.pow(10, settings.preamp / 20) : 1.0;
      this.preampGain.gain.setTargetAtTime(preampVal, this.audioCtx.currentTime, 0.05);
    }

    this.filters.forEach((filter, index) => {
      const gainVal = enabled ? (settings.bands[index] ?? 0) : 0;
      filter.gain.setTargetAtTime(gainVal, this.audioCtx!.currentTime, 0.05);
    });

    if (this.bassFilter) {
      const bassDb = enabled ? (settings.bassBoost / 100) * 12 : 0;
      this.bassFilter.gain.setTargetAtTime(bassDb, this.audioCtx.currentTime, 0.05);
    }

    if (this.surroundGain) {
      const surroundVal = enabled && settings.surround ? 0.35 : 0;
      this.surroundGain.gain.setTargetAtTime(surroundVal, this.audioCtx.currentTime, 0.05);
    }
  }

  public getFrequencyData(array: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(array as unknown as Uint8Array<ArrayBuffer>);
    } else {
      array.fill(0);
    }
  }

  public getTimeDomainData(array: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(array as unknown as Uint8Array<ArrayBuffer>);
    } else {
      array.fill(128);
    }
  }

  public setCallbacks(callbacks: {
    onEnded?: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    onPlayState?: (playing: boolean) => void;
    onHeadsetDisconnect?: () => void;
  }): void {
    if (callbacks.onEnded) this.onTrackEndedCallback = callbacks.onEnded;
    if (callbacks.onPrev) this.onPrevCallback = callbacks.onPrev;
    if (callbacks.onNext) this.onNextCallback = callbacks.onNext;
    if (callbacks.onPlayState) {
      this.onExternalPlayCallback = () => callbacks.onPlayState?.(true);
      this.onExternalPauseCallback = () => callbacks.onPlayState?.(false);
    }
    if (callbacks.onHeadsetDisconnect) {
      this.onAudioOutputDisconnected = callbacks.onHeadsetDisconnect;
    }
  }

  public refreshMediaSessionMetadata(track: Track): void {
    if (this.currentTrack?.id === track.id) {
      this.currentTrack = track;
      this.setupMediaSession(track);
    }
  }

  private setupMediaSession(track: Track): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      const artwork = track.coverUrl
        ? [
            { src: track.coverUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: track.coverUrl, sizes: '128x128', type: 'image/jpeg' },
            { src: track.coverUrl, sizes: '192x192', type: 'image/jpeg' },
            { src: track.coverUrl, sizes: '256x256', type: 'image/jpeg' },
            { src: track.coverUrl, sizes: '512x512', type: 'image/jpeg' },
          ]
        : [{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' }];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Prime One',
        artwork,
      });

      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('play', () => {
        this.resume();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (this.onPrevCallback) this.onPrevCallback();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (this.onNextCallback) this.onNextCallback();
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(this.audio.currentTime - offset);
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        this.seek(this.audio.currentTime + offset);
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      });
    } catch (err) {
      console.warn('MediaSession setup warning:', err);
    }
  }

  private updateMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none'): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = state;
    }
  }

  private updateMediaSessionPosition(): void {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && navigator.mediaSession.setPositionState) {
      try {
        const duration = this.getDuration();
        if (duration > 0 && !Number.isNaN(duration)) {
          navigator.mediaSession.setPositionState({
            duration,
            playbackRate: this.audio.playbackRate || 1,
            position: Math.min(this.audio.currentTime, duration),
          });
        }
      } catch {
        // Ignored
      }
    }
  }

  public startAmbientGenerator(mode: 'rain-chords' | 'binaural-432' | 'space-drone' | 'lofi-warmth'): void {
    this.audio.pause();
    this.ensureContext();
    if (!this.audioCtx) return;

    this.stopSynth();
    this.isSynthPlaying = true;
    this.currentAmbientMode = mode;

    this.synthMasterGain = this.audioCtx.createGain();
    this.synthMasterGain.gain.setValueAtTime(0.4, this.audioCtx.currentTime);

    if (this.analyser) {
      this.synthMasterGain.connect(this.analyser);
    } else {
      this.synthMasterGain.connect(this.audioCtx.destination);
    }

    const ambientTitles: Record<string, { title: string }> = {
      'rain-chords': { title: 'Lofi Rain & Warm Chords' },
      'binaural-432': { title: '432Hz Deep Focus Pulse' },
      'space-drone': { title: 'Celestial Deep Void' },
      'lofi-warmth': { title: 'Midnight Nostalgia Pad' },
    };

    const info = ambientTitles[mode] || { title: 'Ambient Soundscape' };

    this.currentTrack = {
      id: `ambient-${mode}`,
      title: info.title,
      artist: 'Prime One Soundscapes',
      album: 'Pure Offline Generator',
      duration: 3600,
      url: '#ambient',
      genre: 'Generative / Ambient',
      folderPath: 'Internal Storage/Ambient',
      source: 'curated',
      dateAdded: Date.now(),
      coverUrl: '/src/assets/images/album_cover_solar_winds_1794252387764.jpg',
      lyrics:
        '[00:00.00] Infinite generative audio flow\n[00:10.00] Synthesized in real-time by your device\n[00:25.00] Relax, focus, or sleep soundly...',
    };

    this.setupMediaSession(this.currentTrack);

    const chords = [
      [220, 261.63, 329.63, 392],
      [174.61, 220, 261.63, 329.63],
      [130.81, 164.81, 196, 246.94],
      [196, 246.94, 293.66, 349.23],
    ];

    let chordIndex = 0;

    const playChord = () => {
      if (!this.isSynthPlaying || !this.audioCtx || !this.synthMasterGain) return;

      const currentChord = chords[chordIndex % chords.length];
      chordIndex++;

      const chordGain = this.audioCtx.createGain();
      chordGain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
      chordGain.gain.exponentialRampToValueAtTime(0.12, this.audioCtx.currentTime + 2.5);
      chordGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 7.5);
      chordGain.connect(this.synthMasterGain);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(mode === 'space-drone' ? 380 : 850, this.audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1400, this.audioCtx.currentTime + 3);
      filter.frequency.exponentialRampToValueAtTime(450, this.audioCtx.currentTime + 7.5);
      filter.connect(chordGain);

      currentChord.forEach((freq, i) => {
        const osc = this.audioCtx!.createOscillator();
        osc.type = mode === 'binaural-432' ? 'sine' : i % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq + (i === 1 ? 0.75 : -0.5), this.audioCtx!.currentTime);
        osc.connect(filter);
        osc.start();
        osc.stop(this.audioCtx!.currentTime + 8);
      });
    };

    playChord();
    this.synthInterval = window.setInterval(playChord, 7000);
  }

  public stopSynth(): void {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    if (this.synthMasterGain) {
      try {
        this.synthMasterGain.disconnect();
      } catch {
        // Ignored
      }
      this.synthMasterGain = null;
    }
    this.isSynthPlaying = false;
    this.currentAmbientMode = null;
  }

  public isAmbientActive(): boolean {
    return this.isSynthPlaying;
  }

  public getAmbientMode(): string | null {
    return this.currentAmbientMode;
  }
}

export const audioEngine = new AudioEngine();

export function triggerHaptic(duration = 15): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignore
    }
  }
}

export function formatDurationHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `00:${pad(mins)}:${pad(secs)}`;
}
