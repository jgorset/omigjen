import { execFile } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import type { Plugin } from 'vite';

const exec = promisify(execFile);
const prefix = '/api/youtube-audio';
const validId = /^[\w-]{11}$/;

export function youtubeAudioMiddleware(root: string) {
  const cache = path.join(root, '.cache', 'youtube');
  // ponytail: one download at a time on this local server; add a queue if needed.
  let active: { id: string; promise: Promise<void> } | null = null;
  const metadataPath = (id: string) => path.join(cache, `${id}.json`);
  const audioPath = (id: string) => path.join(cache, `${id}.mp3`);
  const json = (res: ServerResponse, code: number, data: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  async function cached(id: string) {
    try {
      const info = JSON.parse(await readFile(metadataPath(id), 'utf8'));
      return info.id === id && typeof info.title === 'string' && (await stat(audioPath(id))).size > 0 ? info as { id: string; title: string } : null;
    } catch { return null; }
  }
  async function download(id: string) {
    await mkdir(cache, { recursive: true });
    const folder = await mkdtemp(path.join(cache, `${id}-`));
    const binary = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';
    const local = path.join(root, '.tools', binary);
    try {
      await exec(existsSync(local) ? local : 'yt-dlp', [
        '--ignore-config', '--no-plugin-dirs', '--no-playlist', '--no-progress', '--quiet',
        '--no-cookies', '--no-cookies-from-browser', '--js-runtimes', `node:${process.execPath}`,
        '--match-filter', '!is_live & duration <= 7200', '--max-filesize', '200M',
        '--socket-timeout', '20', '--retries', '2', '--extractor-retries', '2',
        '-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '192K',
        '--write-info-json', '-o', path.join(folder, 'audio.%(ext)s'),
        '--', `https://www.youtube.com/watch?v=${id}`,
      ], { windowsHide: true, timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 });
      const info = JSON.parse(await readFile(path.join(folder, 'audio.info.json'), 'utf8'));
      if (!(await stat(path.join(folder, 'audio.mp3'))).size) throw new Error('Tom lydfil');
      await writeFile(path.join(folder, 'title.json'), JSON.stringify({ id, title: String(info.title || 'YouTube-opptak') }));
      await rename(path.join(folder, 'title.json'), metadataPath(id));
      await rename(path.join(folder, 'audio.mp3'), audioPath(id));
    } finally { await rm(folder, { recursive: true, force: true }); }
  }
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const host = req.headers.host || '';
    const hostname = new URL(`http://${host}`).hostname;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname) || (req.headers.origin && req.headers.origin !== `http://${host}`)) {
      json(res, 403, { error: 'Lydhenting er bare tilgjengelig fra den lokale appen.' }); return;
    }
    const pathname = new URL(req.url!, `http://${host}`).pathname;
    if (pathname === prefix && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) { json(res, 415, { error: 'Send en YouTube-video som JSON.' }); return; }
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 1024) { json(res, 413, { error: 'Lenken er for lang.' }); return; }
      }
      let id: unknown;
      try { id = JSON.parse(body).id; } catch { /* Invalid input is handled below. */ }
      if (typeof id !== 'string' || !validId.test(id)) { json(res, 400, { error: 'Bruk en lenke til én YouTube-video.' }); return; }
      let info = await cached(id);
      if (!info) {
        if (active && active.id !== id) { json(res, 429, { error: 'En annen låt hentes. Vent litt og prøv igjen.' }); return; }
        if (!active) {
          const promise = download(id);
          active = { id, promise };
          void promise.finally(() => { active = null; }).catch(() => {});
        }
        await active.promise;
        info = await cached(id);
        if (!info) throw new Error('Lydfilen mangler');
      }
      json(res, 200, { ...info, url: `${prefix}/${id}.mp3` }); return;
    }
    const match = new RegExp(`^${prefix}/([\\w-]{11})\\.mp3$`).exec(pathname);
    if (match && ['GET', 'HEAD'].includes(req.method || '')) {
      const file = audioPath(match[1]);
      if (!await cached(match[1])) { json(res, 404, { error: 'Lydfilen finnes ikke. Hent låten på nytt.' }); return; }
      const { size } = await stat(file);
      let start = 0, end = size - 1;
      if (req.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (range && (range[1] || range[2])) {
          start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
          end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
        }
        if (!range || !(range[1] || range[2]) || start > end || start >= size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return;
        }
      }
      res.writeHead(req.headers.range ? 206 : 200, {
        'Content-Type': 'audio/mpeg', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=31536000, immutable',
        ...(req.headers.range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
      });
      if (req.method === 'HEAD') res.end();
      else await pipeline(createReadStream(file, { start, end }), res);
      return;
    }
    json(res, 404, { error: 'Ukjent lydadresse.' });
  }
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.split('?')[0].startsWith(prefix)) { next(); return; }
    void handle(req, res).catch(error => {
      if (res.destroyed || res.headersSent) return;
      console.warn('YouTube-lyd:', error.stderr || error.message);
      const reason = error.code === 'ENOENT' ? 'Lydhenting er ikke satt opp. Kjør npm run setup:downloads og prøv igjen.'
        : /ffmpeg|ffprobe/i.test(error.stderr || '') ? 'FFmpeg mangler. Installer FFmpeg i PATH og start serveren på nytt.'
        : 'Lyden kunne ikke hentes. Prøv igjen eller velg en annen video. Private videoer, direktesendinger og opptak over to timer støttes ikke.';
      json(res, 502, { error: reason });
    });
  };
}

export function youtubeAudio(): Plugin {
  return {
    name: 'omigjen-youtube-audio',
    configureServer(server) { server.middlewares.use(youtubeAudioMiddleware(server.config.root)); },
    configurePreviewServer(server) { server.middlewares.use(youtubeAudioMiddleware(server.config.root)); },
  };
}
