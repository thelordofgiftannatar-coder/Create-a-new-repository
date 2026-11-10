import 'dotenv/config';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import express from 'express';
import type { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import JSZip from 'jszip';
import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';
import type { Content, GenerateContentResponse, LiveServerMessage } from '@google/genai';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

type ChatMessageInput = {
  role: 'user' | 'model';
  text: string;
};

type NowPlayingContext = {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
};

type ChatRequestBody = {
  messages?: ChatMessageInput[];
  mode?: 'fast' | 'balanced' | 'deep';
  systemInstruction?: string;
  nowPlaying?: NowPlayingContext | null;
};

const VALID_VOICES = new Set(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir']);

function getGenAIClient(apiVersion?: string): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      ...(apiVersion ? { apiVersion } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorMessage(err: unknown): string {
  let candidate = '';
  if (err instanceof Error) {
    candidate = err.message;
  } else if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    const nestedErr = rec.error as Record<string, unknown> | undefined;
    if (typeof rec.message === 'string' && rec.message) {
      candidate = rec.message;
    } else if (nestedErr && typeof nestedErr.message === 'string' && nestedErr.message) {
      candidate = nestedErr.message;
    } else if (typeof rec.reason === 'string' && rec.reason) {
      candidate = rec.reason;
    } else {
      try {
        candidate = JSON.stringify(err);
      } catch {
        candidate = String(err);
      }
    }
  } else {
    candidate = String(err);
  }

  // Unwrap serialized Google API JSON payloads inside Error.message
  let trimmed = candidate.trim();
  for (let i = 0; i < 2; i++) {
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as { error?: { message?: string }; message?: string };
        const inner = parsed.error?.message || parsed.message;
        if (typeof inner === 'string' && inner.trim()) {
          trimmed = inner.trim();
          continue;
        }
      } catch {
        break;
      }
    }
    break;
  }
  return trimmed;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = extractErrorMessage(err);
  if (
    raw.includes('PERMISSION_DENIED') ||
    raw.includes('403') ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('API key')
  ) {
    return {
      status: 403,
      message: 'API key missing or rejected. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Rate limit or quota reached for this Gemini model. Wait briefly or switch to Fast (3.1 Flash Lite).',
    };
  }
  if (raw.includes('UNAVAILABLE') || raw.includes('503') || raw.includes('high demand')) {
    return {
      status: 503,
      message: 'The selected Gemini model is temporarily experiencing high demand. Please retry or switch to Fast (3.1 Flash Lite).',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      message: `Requested Gemini endpoint or model unavailable: ${raw}`,
    };
  }
  return {
    status: 500,
    message: raw || 'Unexpected server error communicating with Gemini.',
  };
}

function buildSystemInstruction(basePersona: string, nowPlaying?: NowPlayingContext | null): string {
  const parts: string[] = [
    basePersona.trim() ||
      'You are Prime One Companion, a concise, knowledgeable music curator, audio engineer, and ID3 tag assistant built into the Prime One Android music player.',
  ];
  if (nowPlaying?.title) {
    parts.push(
      `Listener context — currently active track in Prime One: "${nowPlaying.title}" by ${nowPlaying.artist || 'Unknown Artist'}${
        nowPlaying.album ? ` (Album: ${nowPlaying.album})` : ''
      }${nowPlaying.genre ? `, Genre: ${nowPlaying.genre}` : ''}.`
    );
  }
  return parts.join('\n\n');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/gemini/status', (_req: Request, res: Response) => {
    res.json({
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      models: {
        fast: 'gemini-3.1-flash-lite',
        balanced: 'gemini-3.8-flash',
        deep: 'gemini-3.8-flash',
        live: 'gemini-3.8-live',
      },
      paidModelEnabled: false,
    });
  });

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured. Configure it in AI Studio Settings > Secrets.',
      });
      return;
    }

    const body = (req.body || {}) as ChatRequestBody;
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const cleaned = rawMessages
      .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
      .map((m) => ({
        role: (m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
        text: m.text.trim(),
      }));

    if (cleaned.length === 0) {
      res.status(400).json({ error: 'At least one message is required.' });
      return;
    }

    const latest = cleaned[cleaned.length - 1];
    const priorHistory: Content[] = cleaned.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const mode = body.mode || 'balanced';
    const model =
      mode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';
    const thinkingLevel =
      mode === 'fast'
        ? ThinkingLevel.MINIMAL
        : mode === 'deep'
        ? ThinkingLevel.HIGH
        : ThinkingLevel.MEDIUM;

    const systemInstruction = buildSystemInstruction(
      typeof body.systemInstruction === 'string' ? body.systemInstruction : '',
      body.nowPlaying
    );

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const writeRaw = (chunk: string) => {
      if (!res.writableEnded) {
        res.write(chunk);
      }
    };
    const writeEvent = (payload: Record<string, unknown>) => {
      writeRaw(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Emit initial SSE comment immediately so reverse proxies / clients receive first bytes
    writeRaw(': open\n\n');

    let clientClosed = false;
    const reqController = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
        reqController.abort(new Error('Client disconnected'));
      }
    });

    const keepaliveTimer = setInterval(() => {
      writeRaw(': keepalive\n\n');
    }, 2500);

    const tStart = Date.now();
    console.log(`[gemini/chat] start mode=${mode} model=${model} thinking=${thinkingLevel}`);

    try {
      const runAttempt = async (
        targetModel: string,
        targetThinking: ThinkingLevel,
        firstByteTimeoutMs: number
      ) => {
        const attemptController = new AbortController();
        const onParentAbort = () => attemptController.abort(reqController.signal.reason);
        reqController.signal.addEventListener('abort', onParentAbort, { once: true });

        let gotAnyChunk = false;
        let lastThinkingEmit = 0;
        const firstByteTimer = setTimeout(() => {
          if (!gotAnyChunk) {
            attemptController.abort(
              new Error(`Upstream timeout after ${firstByteTimeoutMs}ms waiting for ${targetModel}`)
            );
          }
        }, firstByteTimeoutMs);

        try {
          const chat = ai.chats.create({
            model: targetModel,
            history: priorHistory,
            config: {
              systemInstruction,
              abortSignal: attemptController.signal,
              thinkingConfig: {
                thinkingLevel: targetThinking,
              },
            },
          });

          const streamResponse = await chat.sendMessageStream({
            message: latest.text,
            config: {
              abortSignal: attemptController.signal,
            },
          });

          console.log(
            `[gemini/chat] stream opened model=${targetModel} in ${Date.now() - tStart}ms`
          );

          for await (const chunk of streamResponse) {
            if (!gotAnyChunk) {
              gotAnyChunk = true;
              clearTimeout(firstByteTimer);
              console.log(
                `[gemini/chat] first chunk model=${targetModel} in ${Date.now() - tStart}ms`
              );
            }
            if (clientClosed) break;

            const c = chunk as GenerateContentResponse;
            const parts = c.candidates?.[0]?.content?.parts as
              | Array<{ thought?: boolean; text?: string }>
              | undefined;
            const hasThought = Boolean(parts?.some((p) => p?.thought));

            if (hasThought && !c.text) {
              const now = Date.now();
              if (now - lastThinkingEmit > 800) {
                lastThinkingEmit = now;
                writeEvent({ thinking: true, model: targetModel });
              }
            }

            if (c.text) {
              writeEvent({ delta: c.text });
            }
          }
        } finally {
          clearTimeout(firstByteTimer);
          reqController.signal.removeEventListener('abort', onParentAbort);
        }
      };

      let activeModel = model;
      const firstByteBudgetMs =
        mode === 'deep' ? 22000 : mode === 'balanced' ? 14000 : 12000;

      try {
        await runAttempt(model, thinkingLevel, firstByteBudgetMs);
      } catch (firstErr) {
        if (clientClosed) return;
        const { status, message } = formatGeminiError(firstErr);
        const isTimeout = message.toLowerCase().includes('timeout') || (firstErr as Error)?.name === 'AbortError';
        console.warn(
          `[gemini/chat] primary attempt failed model=${model} status=${status} msg="${message}" (${Date.now() - tStart}ms)`
        );

        if ((status === 503 || isTimeout) && mode === 'balanced' && model === 'gemini-3.8-flash') {
          activeModel = 'gemini-3.1-flash-lite';
          writeEvent({ status: 'fallback', model: activeModel });
          await runAttempt('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL, 12000);
        } else {
          throw firstErr;
        }
      }

      if (!clientClosed) {
        writeEvent({ done: true, model: activeModel });
        res.end();
      }
      console.log(`[gemini/chat] complete model=${activeModel} total=${Date.now() - tStart}ms`);
    } catch (err) {
      if (!clientClosed) {
        const rawMsg = extractErrorMessage(err);
        const isTimeout =
          rawMsg.toLowerCase().includes('timeout') || (err as Error)?.name === 'AbortError';
        const formatted = isTimeout
          ? 'The selected Gemini model timed out under heavy load. Please retry or switch to Fast (3.1 Flash Lite).'
          : formatGeminiError(err).message;
        console.error(`[gemini/chat] error (${Date.now() - tStart}ms):`, rawMsg);
        writeEvent({ error: formatted });
        res.end();
      }
    } finally {
      clearInterval(keepaliveTimer);
    }
  });

  const EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    '.aistudio',
    '.vscode',
    'tmp',
    'dist',
    'dev-dist',
    'android',
    'build',
    'coverage',
    '.cache',
    '.local',
    '.idea',
  ]);

  const EXCLUDED_PATH_PREFIXES = ['public/assets/aistudio', 'android-config/res'];
  const EXCLUDED_ZIP_FILES = new Set([
    'android-config/AndroidManifest.xml',
    'eslint.config.js',
    'firestore.rules.test.ts',
    'security_spec.md',
    'firebase-blueprint.json',
    'metadata.json',
    'public/icon.svg',
    '.env.example',
  ]);

  function shouldIncludeZipFile(relPosixPath: string): boolean {
    if (!relPosixPath) return false;
    for (const prefix of EXCLUDED_PATH_PREFIXES) {
      if (relPosixPath === prefix || relPosixPath.startsWith(`${prefix}/`)) {
        return false;
      }
    }
    if (EXCLUDED_ZIP_FILES.has(relPosixPath)) {
      return false;
    }
    const baseName = path.posix.basename(relPosixPath);
    if (
      baseName === '.DS_Store' ||
      baseName === 'bun.lock' ||
      baseName.endsWith('.zip') ||
      baseName.endsWith('.log')
    ) {
      return false;
    }
    if (baseName.startsWith('.env') && baseName !== '.env.example') {
      return false;
    }
    return true;
  }

  function addDirectoryToZip(zip: JSZip, rootDir: string, currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPosix = path.relative(rootDir, fullPath).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        if (EXCLUDED_PATH_PREFIXES.some((p) => relPosix === p || relPosix.startsWith(`${p}/`))) {
          continue;
        }
        addDirectoryToZip(zip, rootDir, fullPath);
      } else if (entry.isFile()) {
        if (!shouldIncludeZipFile(relPosix)) continue;
        const data = fs.readFileSync(fullPath);
        zip.file(relPosix, data, {
          createFolders: false,
          unixPermissions: relPosix.endsWith('.sh') ? 0o755 : 0o644,
        });
      }
    }
  }

  app.get('/api/export/github-zip', (_req: Request, res: Response) => {
    try {
      const projectRoot = process.cwd();
      const zip = new JSZip();
      addDirectoryToZip(zip, projectRoot, projectRoot);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="Prime-One-GitHub-App.zip"');
      res.setHeader('Cache-Control', 'no-store');

      zip
        .generateNodeStream({
          type: 'nodebuffer',
          streamFiles: true,
          platform: 'UNIX',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        })
        .on('error', (streamErr) => {
          console.error('[export/github-zip] stream error:', streamErr);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate GitHub ZIP stream.' });
          } else {
            res.end();
          }
        })
        .pipe(res);
    } catch (err) {
      console.error('[export/github-zip] error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to package repository ZIP.',
      });
    }
  });

  app.get('/api/export/workflow', (_req: Request, res: Response) => {
    try {
      const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'build-android-apk.yml');
      if (!fs.existsSync(workflowPath)) {
        res.status(404).json({ error: 'GitHub Actions workflow file not found.' });
        return;
      }
      const yaml = fs.readFileSync(workflowPath, 'utf8');
      res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="build-android-apk.yml"');
      res.setHeader('Cache-Control', 'no-store');
      res.send(yaml);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to read workflow file.',
      });
    }
  });

  app.get('/api/export/html', async (_req: Request, res: Response) => {
    try {
      const projectRoot = process.cwd();
      const distDir = path.join(projectRoot, 'dist');
      const distHtmlPath = path.join(distDir, 'index.html');

      if (!fs.existsSync(distHtmlPath)) {
        const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        await execFileAsync(npxCmd, ['vite', 'build'], { cwd: projectRoot });
      }

      if (!fs.existsSync(distHtmlPath)) {
        res.status(500).json({ error: 'Production bundle not available to package HTML.' });
        return;
      }

      let html = fs.readFileSync(distHtmlPath, 'utf8');

      // Inline stylesheets
      html = html.replace(
        /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
        (_match, href: string) => {
          const clean = href.replace(/^\//, '');
          const cssPath = path.join(distDir, clean);
          if (fs.existsSync(cssPath)) {
            const css = fs.readFileSync(cssPath, 'utf8');
            return `<style>${css}</style>`;
          }
          return '';
        }
      );

      // Build map of static asset files in dist/ (and public/) to data URLs
      const assetDataUrls = new Map<string, string>();
      const mimeByExt: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };

      const distAssetsDir = path.join(distDir, 'assets');
      if (fs.existsSync(distAssetsDir)) {
        for (const name of fs.readdirSync(distAssetsDir)) {
          const ext = path.extname(name).toLowerCase();
          const mime = mimeByExt[ext];
          if (mime) {
            const b64 = fs.readFileSync(path.join(distAssetsDir, name)).toString('base64');
            assetDataUrls.set(`/assets/${name}`, `data:${mime};base64,${b64}`);
          }
        }
      }

      const publicDir = path.join(projectRoot, 'public');
      for (const pubFile of [
        'app-cover.png',
        'icon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'pwa-maskable-512x512.png',
      ]) {
        const fp = path.join(publicDir, pubFile);
        const ext = path.extname(pubFile).toLowerCase();
        if (fs.existsSync(fp) && mimeByExt[ext]) {
          const b64 = fs.readFileSync(fp).toString('base64');
          assetDataUrls.set(`/${pubFile}`, `data:${mimeByExt[ext]};base64,${b64}`);
        }
      }

      // Inline icons & strip manifest / service worker registration for single-file portability
      html = html.replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi, '');
      html = html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '');
      html = html.replace(/<script\b[^>]*src=["'][^"']*registerSW\.js["'][^>]*>\s*<\/script>/gi, '');
      html = html.replace(
        /<link\b([^>]*href=["'](\/[^"']+\.(?:svg|png|ico))["'][^>]*)>/gi,
        (full, attrs: string, href: string) => {
          const dataUrl = assetDataUrls.get(href);
          if (!dataUrl) return full;
          return `<link${attrs.replace(href, dataUrl)}>`;
        }
      );

      // Inline compiled JS bundle(s) with embedded image data URLs (quotes and template literals)
      html = html.replace(
        /<script\b([^>]*?)src=["']([^"']+\.js)["']([^>]*)>\s*<\/script>/gi,
        (full, pre: string, src: string, post: string) => {
          const clean = src.replace(/^\//, '');
          const jsPath = path.join(distDir, clean);
          if (!fs.existsSync(jsPath)) return full;
          let js = fs.readFileSync(jsPath, 'utf8');
          for (const [assetPath, dataUrl] of assetDataUrls.entries()) {
            js = js
              .split(`"${assetPath}"`)
              .join(`"${dataUrl}"`)
              .split(`'${assetPath}'`)
              .join(`'${dataUrl}'`)
              .split(`\`${assetPath}\``)
              .join(`"${dataUrl}"`);
          }
          // Escape closing script tag literals safely inside JS strings/templates
          js = js.replace(/<\/script/gi, '<\\/script');
          const attrs = `${pre} ${post}`.replace(/\bcrossorigin\b/gi, '').trim();
          return `<script ${attrs}>${js}</script>`;
        }
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Prime-One-Player.html"');
      res.setHeader('Cache-Control', 'no-store');
      res.send(html);
    } catch (err) {
      console.error('[export/html] error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to export standalone HTML.',
      });
    }
  });

  app.post('/api/gemini/compose-theme', async (req: Request, res: Response) => {
    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const body = (req.body || {}) as {
      prompt?: string;
      themeName?: string;
      artStyle?: string;
    };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 600) : '';
    const themeName = typeof body.themeName === 'string' ? body.themeName.trim().slice(0, 80) : 'Custom Universe';
    const artStyle = typeof body.artStyle === 'string' ? body.artStyle.trim().slice(0, 40) : 'comic-splash';

    if (!prompt) {
      res.status(400).json({ error: 'Scene prompt is required.' });
      return;
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        themeName: { type: Type.STRING },
        badge: { type: Type.STRING },
        suggestedEffect: {
          type: Type.STRING,
          enum: [
            'red-smoke',
            'rain',
            'stars',
            'portal',
            'embers',
            'fireflies',
            'candles',
            'digital-rain',
            'snow',
            'sandstorm',
            'aurora-waves',
            'prism-rays',
            'scanlines',
          ],
        },
        palette: {
          type: Type.OBJECT,
          properties: {
            skyTop: { type: Type.STRING },
            skyMid: { type: Type.STRING },
            skyHorizon: { type: Type.STRING },
            primaryGlow: { type: Type.STRING },
            secondaryGlow: { type: Type.STRING },
            architectureDark: { type: Type.STRING },
            architectureLit: { type: Type.STRING },
            rimLight: { type: Type.STRING },
            fogTint: { type: Type.STRING },
          },
          required: [
            'skyTop',
            'skyMid',
            'skyHorizon',
            'primaryGlow',
            'secondaryGlow',
            'architectureDark',
            'architectureLit',
            'rimLight',
            'fogTint',
          ],
        },
        celestial: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              enum: [
                'eclipse',
                'twin-moons',
                'portal',
                'full-moon',
                'nebula',
                'sunburst',
                'bat-beacon',
                'planet-limb',
              ],
            },
            xRatio: { type: Type.NUMBER },
            yRatio: { type: Type.NUMBER },
            radiusRatio: { type: Type.NUMBER },
          },
          required: ['type', 'xRatio', 'yRatio', 'radiusRatio'],
        },
        skylineType: {
          type: Type.STRING,
          enum: [
            'gothic-spires',
            'cyberpunk-towers',
            'castle-cliff',
            'ancient-forest',
            'desert-dunes',
            'sea-drakkar',
            'orbital-ring',
            'ruined-cathedral',
          ],
        },
        silhouetteType: {
          type: Type.STRING,
          enum: [
            'lone-warrior',
            'caped-vigilante',
            'netrunner',
            'mage-staff',
            'flying-hero',
            'viking-bow',
            'dual-rift',
            'none',
          ],
        },
        architectureDensity: { type: Type.NUMBER },
        lightBeams: { type: Type.NUMBER },
        starDensity: { type: Type.NUMBER },
        rainStreaks: { type: Type.NUMBER },
        emberGlow: { type: Type.NUMBER },
        vignetteStrength: { type: Type.NUMBER },
      },
      required: [
        'themeName',
        'badge',
        'suggestedEffect',
        'palette',
        'celestial',
        'skylineType',
        'silhouetteType',
        'architectureDensity',
        'lightBeams',
        'starDensity',
        'rainStreaks',
        'emberGlow',
        'vignetteStrength',
      ],
    };

    const instruction =
      'You are an Art Director for Prime One Hi-Fi Music Player themes. Given a user scene idea, design a dramatic high-contrast 4K comic-book wallpaper color palette (6-digit hex codes like #ef4444) and structural composition parameters. Keep upper sky dark enough (#03050c to #221035) for legible white UI text.';
    const userMsg = `Theme Name: "${themeName}"\nArt Style: ${artStyle}\nScene Description: ${prompt}`;

    const attemptCompose = async (targetModel: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite') => {
      const response = await ai.models.generateContent({
        model: targetModel,
        contents: userMsg,
        config: {
          systemInstruction: instruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
          ...(targetModel === 'gemini-3.8-flash'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });
      const text = (response.text ?? '{}').trim();
      return JSON.parse(text);
    };

    try {
      const composition = await attemptCompose('gemini-3.8-flash');
      res.json({ composition, model: 'gemini-3.8-flash' });
    } catch (primaryErr) {
      const { status } = formatGeminiError(primaryErr);
      if (status === 503 || status === 429) {
        try {
          const fallbackComp = await attemptCompose('gemini-3.1-flash-lite');
          res.json({ composition: fallbackComp, model: 'gemini-3.1-flash-lite' });
          return;
        } catch (fallbackErr) {
          const f = formatGeminiError(fallbackErr);
          res.status(f.status).json({ error: f.message });
          return;
        }
      }
      const f = formatGeminiError(primaryErr);
      res.status(f.status).json({ error: f.message });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });

    // Prevent Vite dev client from opening failing WebSockets to port 24678 when HMR is disabled
    app.get('/@vite/client', async (_req: Request, res: Response, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) {
          next();
          return;
        }
        const patched = result.code.replace(
          /createConnection:\s*\(\)\s*=>\s*new WebSocket\([^)]*\)/g,
          'createConnection: () => ({ readyState: 1, OPEN: 1, addEventListener() {}, send() {}, close() {} })'
        );
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(patched);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const parsed = new URL(request.url || '/', 'http://localhost');
      if (parsed.pathname === '/api/gemini/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs: WebSocket, req: http.IncomingMessage) => {
    const ai = getGenAIClient('v1beta');
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        })
      );
      clientWs.close();
      return;
    }

    const reqUrl = new URL(req.url || '/', 'http://localhost');
    const rawVoice = reqUrl.searchParams.get('voice') || 'Zephyr';
    const voiceName = VALID_VOICES.has(rawVoice) ? rawVoice : 'Zephyr';
    const persona = reqUrl.searchParams.get('persona') || '';
    const trackTitle = reqUrl.searchParams.get('trackTitle') || '';
    const trackArtist = reqUrl.searchParams.get('trackArtist') || '';

    const systemInstruction = buildSystemInstruction(
      persona ||
        'You are Prime One Live Voice Companion inside an Android music player. Keep spoken answers crisp, warm, natural, and helpful for music discovery, playlist ideas, sound settings, and lyrics context.',
      trackTitle ? { title: trackTitle, artist: trackArtist } : null
    );

    let closed = false;
    let errorSent = false;

    const sendWsError = (err: unknown) => {
      if (closed || errorSent || clientWs.readyState !== WebSocket.OPEN) return;
      errorSent = true;
      const { message } = formatGeminiError(err);
      clientWs.send(JSON.stringify({ error: message }));
    };

    const connectLiveWithClient = (client: GoogleGenAI) =>
      client.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction,
        },
        callbacks: {
          onopen: () => {
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ ready: true, voice: voiceName }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (closed || clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;

            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err: unknown) => {
            const msg = extractErrorMessage(err);
            // Allow v1alpha retry if v1beta returns 404 before failing
            if (msg.includes('404')) return;
            sendWsError(err);
          },
          onclose: (ev: { code?: number; reason?: string } | undefined) => {
            if (!closed && clientWs.readyState === WebSocket.OPEN) {
              if (!errorSent && ev?.code && ev.code !== 1000 && ev.reason) {
                sendWsError(new Error(ev.reason));
              } else if (!errorSent) {
                clientWs.send(JSON.stringify({ closed: true, reason: ev?.reason || '' }));
              }
              if (errorSent) clientWs.close();
            }
          },
        },
      });

    const sessionPromise = connectLiveWithClient(ai)
      .catch(async (err: unknown) => {
        const msg = extractErrorMessage(err);
        if (!closed && msg.includes('404')) {
          const alphaClient = getGenAIClient('v1alpha');
          if (alphaClient) {
            try {
              return await connectLiveWithClient(alphaClient);
            } catch (alphaErr) {
              sendWsError(alphaErr);
              if (!closed && clientWs.readyState === WebSocket.OPEN) clientWs.close();
              return null;
            }
          }
        }
        sendWsError(err);
        if (!closed && clientWs.readyState === WebSocket.OPEN) {
          clientWs.close();
        }
        return null;
      });

    clientWs.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      if (closed) return;
      try {
        const parsed = JSON.parse(raw.toString()) as {
          audio?: string;
          text?: string;
        };
        sessionPromise.then((session) => {
          if (!session || closed) return;
          if (typeof parsed.audio === 'string' && parsed.audio.length > 0) {
            session.sendRealtimeInput({
              audio: {
                data: parsed.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (typeof parsed.text === 'string' && parsed.text.trim().length > 0) {
            session.sendRealtimeInput({
              text: parsed.text.trim(),
            });
          }
        });
      } catch (e) {
        console.warn('Malformed Live WS frame:', e);
      }
    });

    clientWs.on('close', () => {
      closed = true;
      sessionPromise.then((session) => {
        try {
          session?.close();
        } catch {
          // ignore close errors on teardown
        }
      });
    });

    clientWs.on('error', () => {
      closed = true;
      sessionPromise.then((session) => {
        try {
          session?.close();
        } catch {
          // ignore
        }
      });
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Prime One server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Prime One server:', err);
  process.exit(1);
});
