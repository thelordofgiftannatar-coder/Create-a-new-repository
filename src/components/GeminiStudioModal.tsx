import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Send,
  MessageSquare,
  AudioLines,
  Trash2,
  SlidersHorizontal,
  Volume2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Music2,
} from 'lucide-react';
import { Track } from '../types/music';
import { audioEngine, triggerHaptic } from '../services/audioEngine';
import { PredictiveBackContainer, PredictiveBackHandle } from './PredictiveBackContainer';

interface GeminiStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
}

type StudioTab = 'voice' | 'chat';
type ChatModelMode = 'fast' | 'balanced' | 'deep';
type LiveVoiceName = 'Zephyr' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelLabel?: string;
}

interface LiveTranscriptItem {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const PERSONA_PRESETS = [
  {
    id: 'curator',
    label: 'Music Curator & DJ',
    prompt:
      'You are a knowledgeable Music Curator & DJ for Prime One. Suggest cohesive transitions, moods, albums, and playlist themes tailored to the user’s library and current track.',
  },
  {
    id: 'tags',
    label: 'Lyrics & ID3 Tag Assistant',
    prompt:
      'You are an ID3 Tag & Lyrics Specialist inside Prime One. Help identify accurate release years, genres, album metadata, and clean synced LRC [mm:ss.xx] lyrics.',
  },
  {
    id: 'engineer',
    label: '5-Band EQ Audio Engineer',
    prompt:
      'You are a Mastering & Acoustic Audio Engineer. Give concise 5-band Equalizer (60Hz, 230Hz, 910Hz, 4kHz, 14kHz), Bass Boost, and soundstage tuning advice for headphones and speakers.',
  },
  {
    id: 'custom',
    label: 'Custom Role',
    prompt:
      'You are a helpful music and audio companion inside Prime One. Answer clearly and concisely.',
  },
] as const;

const VOICES: LiveVoiceName[] = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir'];

function float32PcmToBase64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const sampleCount = Math.floor(bytes.length / 2);
  const float32 = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

function getApiBaseOrigin(): string {
  const configured = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env?.VITE_API_BASE_URL?.trim();
  return configured ? configured.replace(/\/+$/, '') : '';
}

function getLiveWsUrl(params: URLSearchParams): string {
  const base = getApiBaseOrigin();
  if (base) {
    const wsBase = base.replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
    return `${wsBase}/api/gemini/live?${params.toString()}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/gemini/live?${params.toString()}`;
}

export const GeminiStudioModal: React.FC<GeminiStudioModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
}) => {
  const backHandleRef = useRef<PredictiveBackHandle | null>(null);

  const [activeTab, setActiveTab] = useState<StudioTab>('voice');
  const [shareTrackContext, setShareTrackContext] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('curator');
  const [systemInstruction, setSystemInstruction] = useState<string>(PERSONA_PRESETS[0].prompt);
  const [showSystemDrawer, setShowSystemDrawer] = useState(false);

  // Chat State
  const [modelMode, setModelMode] = useState<ChatModelMode>('balanced');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreamingChat, setIsStreamingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);

  // Live Voice State
  const [selectedVoice, setSelectedVoice] = useState<LiveVoiceName>('Zephyr');
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [duckMusic, setDuckMusic] = useState(true);
  const [transcripts, setTranscripts] = useState<LiveTranscriptItem[]>([]);
  const [liveTextInput, setLiveTextInput] = useState('');

  // Refs for real-time audio callbacks (avoids stale React closures per Live API rules!)
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micMutedRef = useRef(micMuted);
  micMutedRef.current = micMuted;
  const levelBarsRef = useRef<(HTMLDivElement | null)[]>([]);
  const micLevelRef = useRef(0);
  const modelSpeakingUntilRef = useRef(0);
  const meterRafRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat & transcripts smoothly
  useEffect(() => {
    chatScrollRef.current?.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const clearScheduledPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // ignore stopped nodes
      }
    });
    activeSourcesRef.current.clear();
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    modelSpeakingUntilRef.current = 0;
  }, []);

  const stopLiveSession = useCallback(() => {
    clearScheduledPlayback();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }

    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }

    micLevelRef.current = 0;
    if (duckMusic) {
      audioEngine.setVolume(1);
    }
    setLiveStatus('idle');
  }, [clearScheduledPlayback, duckMusic]);

  // Clean teardown when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (liveStatus !== 'idle') {
        stopLiveSession();
      }
      if (chatAbortRef.current) {
        chatAbortRef.current.abort();
        chatAbortRef.current = null;
      }
    }
  }, [isOpen, liveStatus, stopLiveSession]);

  useEffect(() => {
    return () => {
      stopLiveSession();
      chatAbortRef.current?.abort();
    };
  }, [stopLiveSession]);

  const startLiveMeterLoop = useCallback(() => {
    const draw = () => {
      const now = performance.now();
      const modelSpeaking = now < modelSpeakingUntilRef.current;
      const baseLevel = modelSpeaking
        ? 0.45 + 0.35 * Math.sin(now * 0.015)
        : Math.min(1, micLevelRef.current * 4.5);

      levelBarsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const wave = 0.25 + 0.75 * Math.abs(Math.sin(now * 0.008 + i * 0.65));
        const scaleY = Math.max(0.14, Math.min(1, baseLevel * wave + (modelSpeaking ? 0.2 : 0.12)));
        bar.style.transform = `scaleY(${scaleY.toFixed(3)})`;
      });

      meterRafRef.current = requestAnimationFrame(draw);
    };
    meterRafRef.current = requestAnimationFrame(draw);
  }, []);

  const schedulePcmOutput = useCallback((base64Audio: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    const float32 = base64Pcm16ToFloat32(base64Audio);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(new Float32Array(float32), 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime + 0.015, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + buffer.duration;
    modelSpeakingUntilRef.current = performance.now() + Math.max(200, (nextStartTimeRef.current - ctx.currentTime) * 1000);

    activeSourcesRef.current.add(src);
    src.onended = () => {
      activeSourcesRef.current.delete(src);
    };
    src.start(startAt);
  }, []);

  const startLiveSession = async () => {
    if (liveStatus === 'connecting' || liveStatus === 'connected') return;

    triggerHaptic(20);
    setLiveError(null);
    setLiveStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const params = new URLSearchParams({
        voice: selectedVoice,
        persona: systemInstruction,
      });
      if (shareTrackContext && currentTrack) {
        params.set('trackTitle', currentTrack.title);
        params.set('trackArtist', currentTrack.artist);
      }

      const ws = new WebSocket(getLiveWsUrl(params));
      wsRef.current = ws;

      ws.onopen = () => {
        if (duckMusic && audioEngine.isPlaying()) {
          audioEngine.setVolume(0.18);
        }
        startLiveMeterLoop();

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        // Avoid mic feedback loop by routing processor through zero-gain sink
        const muteSink = inputCtx.createGain();
        muteSink.gain.value = 0;

        processor.onaudioprocess = (event) => {
          if (micMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            micLevelRef.current = 0;
            return;
          }
          const samples = event.inputBuffer.getChannelData(0);
          let sumSq = 0;
          for (let i = 0; i < samples.length; i += 4) {
            sumSq += samples[i] * samples[i];
          }
          micLevelRef.current = Math.sqrt(sumSq / (samples.length / 4));

          const base64 = float32PcmToBase64(samples);
          wsRef.current.send(JSON.stringify({ audio: base64 }));
        };

        source.connect(processor);
        processor.connect(muteSink);
        muteSink.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            ready?: boolean;
            audio?: string;
            inputTranscript?: string;
            outputTranscript?: string;
            interrupted?: boolean;
            error?: string;
          };

          if (msg.ready) {
            setLiveStatus('connected');
          }
          if (msg.error) {
            setLiveError(msg.error);
            setLiveStatus('error');
          }
          if (msg.interrupted) {
            clearScheduledPlayback();
          }
          if (msg.audio) {
            schedulePcmOutput(msg.audio);
          }
          if (msg.inputTranscript) {
            const textChunk = msg.inputTranscript;
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'user') {
                return [...prev.slice(0, -1), { ...last, text: `${last.text} ${textChunk}`.trim() }];
              }
              return [...prev, { id: `u-${Date.now()}`, role: 'user', text: textChunk.trim() }];
            });
          }
          if (msg.outputTranscript) {
            const textChunk = msg.outputTranscript;
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'model') {
                return [...prev.slice(0, -1), { ...last, text: `${last.text}${textChunk}` }];
              }
              return [...prev, { id: `m-${Date.now()}`, role: 'model', text: textChunk }];
            });
          }
        } catch {
          // ignore non-json frames
        }
      };

      ws.onerror = () => {
        setLiveError('Could not connect WebSocket to Gemini Live server.');
        setLiveStatus('error');
      };

      ws.onclose = () => {
        setLiveStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    } catch (err) {
      setLiveError(
        err instanceof Error
          ? err.message
          : 'Microphone permission denied or audio device unavailable.'
      );
      setLiveStatus('error');
      stopLiveSession();
    }
  };

  const handleSendLiveText = (e: React.FormEvent) => {
    e.preventDefault();
    const text = liveTextInput.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text }));
    setTranscripts((prev) => [...prev, { id: `ut-${Date.now()}`, role: 'user', text }]);
    setLiveTextInput('');
  };

  const handleSendChat = async (e?: React.FormEvent, presetPrompt?: string) => {
    e?.preventDefault();
    const text = (presetPrompt ?? chatInput).trim();
    if (!text || isStreamingChat) return;

    triggerHaptic(12);
    setChatError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };
    const modelLabel =
      modelMode === 'fast'
        ? 'gemini-3.1-flash-lite'
        : modelMode === 'deep'
        ? 'gemini-3.8-flash (High)'
        : 'gemini-3.8-flash';

    const assistantId = `model-${Date.now() + 1}`;
    const updatedHistory = [...messages, userMsg];

    setMessages([
      ...updatedHistory,
      { id: assistantId, role: 'model', text: '', modelLabel },
    ]);
    if (!presetPrompt) setChatInput('');
    setIsStreamingChat(true);

    const controller = new AbortController();
    chatAbortRef.current?.abort();
    chatAbortRef.current = controller;

    try {
      const response = await fetch(`${getApiBaseOrigin()}/api/gemini/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
          mode: modelMode,
          systemInstruction,
          nowPlaying:
            shareTrackContext && currentTrack
              ? {
                  title: currentTrack.title,
                  artist: currentTrack.artist,
                  album: currentTrack.album,
                  genre: currentTrack.genre,
                }
              : null,
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errPayload.error || `Server error (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming response body unavailable.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const line = block.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const payload = JSON.parse(jsonStr) as {
              delta?: string;
              error?: string;
              done?: boolean;
              model?: string;
              status?: string;
              thinking?: boolean;
            };
            if (payload.error) {
              throw new Error(payload.error);
            }
            if (payload.model && (payload.status === 'fallback' || payload.done)) {
              const nextModelLabel =
                payload.model === 'gemini-3.1-flash-lite'
                  ? 'gemini-3.1-flash-lite'
                  : payload.model;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, modelLabel: nextModelLabel } : m
                )
              );
            }
            if (payload.delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: m.text + payload.delta } : m
                )
              );
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.text.trim() === ''))
        );
      } else {
        const message =
          err instanceof Error ? err.message : 'Unable to complete Gemini chat response.';
        setChatError(message);
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantId && m.text.trim() === ''))
        );
      }
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
      }
      setIsStreamingChat(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-transparent">
      <PredictiveBackContainer
        ref={backHandleRef}
        canGoBack={true}
        fullScreenModal={true}
        onBack={() => {
          stopLiveSession();
          onClose();
        }}
        className="flex-1 flex flex-col h-full w-full"
        foregroundContent={
          <div className="w-full h-full bg-[#0b0e17]/96 backdrop-blur-3xl text-slate-100 flex flex-col pt-safe pb-safe overflow-hidden">
            {/* Top App Bar with Predictive Back ← */}
            <header className="px-4 py-3 border-b border-white/10 bg-[#121624]/90 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(12);
                    if (backHandleRef.current) {
                      backHandleRef.current.triggerBack();
                    } else {
                      stopLiveSession();
                      onClose();
                    }
                  }}
                  className="p-2 -ml-2 rounded-full hover:bg-white/10 text-slate-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Back to Prime One"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-white truncate">
                    Prime One Voice &amp; Chat
                  </h1>
                  <p className="text-[11px] text-slate-400 truncate">
                    Real-time Live API &amp; multi-turn music companion
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  setShowSystemDrawer((p) => !p);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 min-h-[38px] ${
                  showSystemDrawer
                    ? 'bg-violet-500/25 border-violet-400 text-violet-200'
                    : 'bg-white/5 border-white/15 text-slate-300 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Role</span>
              </button>
            </header>

            {/* Collapsible System Instruction & Context Drawer */}
            {showSystemDrawer && (
              <div className="px-4 py-3 bg-[#151929] border-b border-white/10 space-y-2.5 max-w-3xl w-full mx-auto">
                <div className="flex flex-wrap items-center gap-1.5">
                  {PERSONA_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(preset.id);
                        setSystemInstruction(preset.prompt);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        selectedPresetId === preset.id
                          ? 'bg-cyan-500 text-black border-cyan-400'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <textarea
                  value={systemInstruction}
                  onChange={(e) => {
                    setSelectedPresetId('custom');
                    setSystemInstruction(e.target.value);
                  }}
                  rows={2}
                  placeholder="Enter custom system instruction for assistant..."
                  className="w-full bg-black/50 border border-white/15 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />

                <div className="flex items-center justify-between text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareTrackContext}
                      onChange={(e) => setShareTrackContext(e.target.checked)}
                      className="accent-cyan-400 rounded"
                    />
                    <span>
                      Share active song ({currentTrack ? currentTrack.title : 'None'})
                    </span>
                  </label>

                  {activeTab === 'voice' && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={duckMusic}
                        onChange={(e) => setDuckMusic(e.target.checked)}
                        className="accent-violet-400 rounded"
                      />
                      <span>Lower player volume during voice</span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Mode Segmented Tabs: Live Voice | Multi-Turn Chat */}
            <div className="px-4 pt-3 pb-2 max-w-3xl w-full mx-auto">
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/45 border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setActiveTab('voice');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition min-h-[40px] ${
                    activeTab === 'voice'
                      ? 'bg-cyan-500 text-black shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <AudioLines className="w-4 h-4" />
                  <span>Live Voice Conversation</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setActiveTab('chat');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition min-h-[40px] ${
                    activeTab === 'chat'
                      ? 'bg-violet-500 text-white shadow-md'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Multi-Turn Chat</span>
                </button>
              </div>
            </div>

            {/* TAB 1: REAL-TIME VOICE CONVERSATIONS (gemini-3.8-live) */}
            {activeTab === 'voice' && (
              <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 pb-4 min-h-0">
                {/* Voice Selector & Audio Visualization Header */}
                <div className="p-4 rounded-3xl bg-white/[0.05] border border-white/10 flex flex-col items-center gap-3">
                  <div className="w-full flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 font-medium">
                      Model: <strong className="text-cyan-300 font-mono">gemini-3.8-live</strong>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={selectedVoice}
                        disabled={liveStatus !== 'idle'}
                        onChange={(e) => setSelectedVoice(e.target.value as LiveVoiceName)}
                        aria-label="Select Live Voice"
                        className="bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                      >
                        {VOICES.map((v) => (
                          <option key={v} value={v} className="bg-[#121624] text-white">
                            Voice: {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Animated GPU Bar Level Visualizer */}
                  <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-xs">
                    {Array.from({ length: 14 }).map((_, idx) => (
                      <div
                        key={idx}
                        ref={(el) => {
                          levelBarsRef.current[idx] = el;
                        }}
                        style={{
                          willChange: 'transform',
                          transform: 'scaleY(0.18)',
                        }}
                        className={`w-2 h-14 rounded-full origin-center transition-colors ${
                          liveStatus === 'connected'
                            ? 'bg-gradient-to-t from-cyan-500 to-violet-400'
                            : 'bg-slate-700/70'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Call Controls */}
                  <div className="flex items-center gap-3">
                    {liveStatus === 'idle' || liveStatus === 'error' ? (
                      <button
                        type="button"
                        onClick={startLiveSession}
                        className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-sm flex items-center gap-2 shadow-xl shadow-cyan-500/25 active:scale-95 transition min-h-[48px]"
                      >
                        <Mic className="w-5 h-5" />
                        <span>Start Voice Session</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic(10);
                            setMicMuted((m) => !m);
                          }}
                          className={`p-3.5 rounded-2xl border transition min-w-[48px] min-h-[48px] flex items-center justify-center ${
                            micMuted
                              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                              : 'bg-white/10 border-white/15 text-white'
                          }`}
                          title={micMuted ? 'Unmute mic' : 'Mute mic'}
                        >
                          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>

                        <button
                          type="button"
                          onClick={stopLiveSession}
                          className="px-6 py-3 rounded-2xl bg-red-500/90 hover:bg-red-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg min-h-[48px]"
                        >
                          {liveStatus === 'connecting' ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <MicOff className="w-4 h-4" />
                          )}
                          <span>
                            {liveStatus === 'connecting' ? 'Connecting...' : 'End Voice Session'}
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  {liveError && (
                    <div className="w-full p-3 rounded-xl bg-red-500/15 border border-red-400/35 text-xs text-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{liveError}</span>
                    </div>
                  )}
                </div>

                {/* Live Transcript Thread */}
                <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 pr-1">
                  {transcripts.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      Tap <strong>Start Voice Session</strong> and speak naturally about your playlist, song trivia, or equalizer settings.
                    </div>
                  ) : (
                    transcripts.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-2xl text-xs max-w-[88%] ${
                          item.role === 'user'
                            ? 'ml-auto bg-cyan-500/20 border border-cyan-400/30 text-white'
                            : 'mr-auto bg-white/[0.06] border border-white/10 text-slate-200'
                        }`}
                      >
                        <div className="text-[10px] font-semibold text-slate-400 mb-0.5">
                          {item.role === 'user' ? 'You (Spoken)' : 'Prime One Voice'}
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{item.text}</p>
                      </div>
                    ))
                  )}
                  <div ref={transcriptEndRef} />
                </div>

                {/* Optional Text Nudge While Live Voice Is Connected */}
                {liveStatus === 'connected' && (
                  <form onSubmit={handleSendLiveText} className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={liveTextInput}
                      onChange={(e) => setLiveTextInput(e.target.value)}
                      placeholder="Or send a text note into the live voice session..."
                      className="flex-1 bg-black/50 border border-white/15 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="submit"
                      className="p-2.5 rounded-2xl bg-cyan-500 text-black min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label="Send note to live session"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: MULTI-TURN CHATBOT */}
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 pb-4 min-h-0">
                {/* Model Selector Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10 text-xs">
                  <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10">
                    {(
                      [
                        { id: 'fast', label: 'Fast · 3.1 Lite' },
                        { id: 'balanced', label: 'Balanced · 3.8 Flash' },
                        { id: 'deep', label: 'Deep Think · 3.8 Flash' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setModelMode(m.id)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition whitespace-nowrap ${
                          modelMode === m.id
                            ? 'bg-violet-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        chatAbortRef.current?.abort();
                        setMessages([]);
                        setChatError(null);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                {/* Scrollable Message Thread */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
                  {messages.length === 0 ? (
                    <div className="py-6 space-y-3 text-center">
                      <Music2 className="w-10 h-10 text-violet-400 mx-auto" />
                      <div className="text-sm font-bold text-white">
                        Ask Prime One anything about music &amp; sound
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                        {[
                          currentTrack
                            ? `Analyze "${currentTrack.title}" and suggest 5 similar songs`
                            : 'Recommend a late-night driving synthwave playlist',
                          'Tune the 5-band EQ for warm bass and crisp vocals',
                          'Help me clean up ID3 tags and genre names',
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => handleSendChat(undefined, suggestion)}
                            className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-slate-200 text-left"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-2xl text-xs max-w-[90%] ${
                          m.role === 'user'
                            ? 'ml-auto bg-cyan-500/20 border border-cyan-400/35 text-white'
                            : 'mr-auto bg-white/[0.06] border border-white/10 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1 text-[10px] text-slate-400">
                          <span className="font-semibold">
                            {m.role === 'user' ? 'You' : `Gemini · ${m.modelLabel || '3.8-flash'}`}
                          </span>
                          {m.role === 'model' && m.text && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(m.text);
                                setCopiedId(m.id);
                                setTimeout(() => setCopiedId(null), 1800);
                              }}
                              className="hover:text-white flex items-center gap-1"
                            >
                              {copiedId === m.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {m.text || (isStreamingChat ? 'Thinking...' : '')}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {chatError && (
                  <div className="mb-2 p-2.5 rounded-xl bg-red-500/15 border border-red-400/35 text-xs text-red-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{chatError}</span>
                  </div>
                )}

                {/* Chat Prompt Input */}
                <form onSubmit={(e) => handleSendChat(e)} className="pt-2 border-t border-white/10 flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask for playlists, EQ presets, lyrics, or track trivia..."
                    className="flex-1 bg-black/50 border border-white/15 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-violet-400"
                  />
                  <button
                    type="submit"
                    disabled={isStreamingChat || !chatInput.trim()}
                    className="p-3 rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white disabled:opacity-40 min-w-[48px] min-h-[48px] flex items-center justify-center shadow-lg"
                    aria-label="Send message"
                  >
                    {isStreamingChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
};
