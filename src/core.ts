export type Phrase = { id: string; name: string; start: number; end: number; speed: number };
export const MIN_LOOP = 0.25;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function formatTime(seconds: number, precise = false): string {
  const tenths = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 10);
  const minutes = Math.floor(tenths / 600);
  const remainder = Math.floor(tenths / 10) % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}${precise ? `.${tenths % 10}` : ''}`;
}

export function parseTime(value: string): number | null {
  const clean = value.trim().replace(',', '.');
  if (!/^(?:\d+:)?\d+(?:\.\d+)?$/.test(clean)) return null;
  const parts = clean.split(':').map(Number);
  if (parts.length === 2 && parts[1] >= 60) return null;
  const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  return Number.isFinite(seconds) ? seconds : null;
}

export function youtubeId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      const segments = url.pathname.split('/');
      id = url.pathname === '/watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(segments[1]) ? segments[2] : null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function readPhrases(raw: string | null): Phrase[] {
  try {
    const data: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(data)) return [];
    return data.filter((p): p is Phrase => !!p && typeof p.id === 'string' && typeof p.name === 'string'
      && p.name.length <= 80 && Number.isFinite(p.start) && p.start >= 0 && Number.isFinite(p.end)
      && p.end - p.start >= MIN_LOOP && Number.isFinite(p.speed) && p.speed >= 0.25 && p.speed <= 2).slice(0, 100);
  } catch { return []; }
}

export function waveformPeaks(samples: Float32Array, count = 2048): number[] {
  const block = Math.max(1, Math.floor(samples.length / count));
  const peaks = Array.from({ length: count }, (_, i) => {
    let peak = 0;
    for (let j = i * block; j < Math.min((i + 1) * block, samples.length); j++) peak = Math.max(peak, Math.abs(samples[j]));
    return peak;
  });
  const max = Math.max(...peaks, 0.01);
  return peaks.map(p => p / max);
}
