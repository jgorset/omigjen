import type { D1Database } from '@cloudflare/workers-types';

type Bindings = { IMPORTS: D1Database; APIFY_TOKEN?: string };
type Import = { id: string; started_at: number; run_id: string | null; store_id: string | null; title: string | null };
const api = 'https://api.apify.com/v2';
const actor = 'ZSKNl5eniyeAPcPkf';
const pending = (id: string) => Response.json({ id, pending: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
const ready = (entry: Import) => Response.json({ id: entry.id, title: entry.title, url: `/api/youtube-audio/${entry.id}.mp3` }, { headers: { 'Cache-Control': 'no-store' } });
class ImportError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

async function apify(path: string, env: Bindings, options: RequestInit = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options, headers: { Authorization: `Bearer ${env.APIFY_TOKEN}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(25000), redirect: 'manual',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { error?: { type?: string } } | null;
    console.error('youtube-import-provider', { status: response.status, code: error?.error?.type });
    if (response.status === 402 || ['monthly-usage-limit-exceeded', 'not-enough-usage-to-run-paid-actor', 'limit-reached'].includes(error?.error?.type || '')) throw new ImportError(503, 'Den felles kvoten for lydhenting er brukt opp. Du kan fortsatt åpne lydfiler og lagrede økter.');
    if (response.status === 429 || error?.error?.type === 'concurrent-runs-limit-exceeded') throw new ImportError(429, 'Flere henter lyd akkurat nå. Prøv igjen om litt.');
    throw new ImportError(502, 'Lyden kunne ikke hentes. Prøv igjen om litt, eller åpne en lydfil.');
  }
  return response;
}

async function bodyId(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ImportError(415, 'Send en YouTube-lenke.');
  const reader = request.body?.getReader();
  if (!reader) throw new ImportError(400, 'YouTube-lenken mangler.');
  let text = ''; let size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); throw new ImportError(413, 'YouTube-lenken er for lang.'); }
    text += decoder.decode(value, { stream: true });
  }
  let id: unknown;
  try { id = JSON.parse(text + decoder.decode()).id; } catch { throw new ImportError(400, 'YouTube-lenken er ugyldig.'); }
  if (typeof id !== 'string' || !/^[\w-]{11}$/.test(id)) throw new ImportError(400, 'YouTube-lenken er ugyldig.');
  return id;
}

async function reserveImport(request: Request, env: Bindings) {
  const now = Math.floor(Date.now() / 1000);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.APIFY_TOKEN}:${ip}`));
  const ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const dayStart = Math.floor(now / 86400) * 86400;
  const [, result] = await env.IMPORTS.batch([
    env.IMPORTS.prepare('DELETE FROM import_attempts WHERE created_at < ?').bind(dayStart),
    env.IMPORTS.prepare(`INSERT INTO import_attempts (key, ip_hash, created_at) SELECT ?, ?, ?
      WHERE (SELECT count(*) FROM import_attempts WHERE created_at >= ?) < 3
      AND (SELECT count(*) FROM import_attempts WHERE created_at >= ?) < 20
      AND (SELECT count(*) FROM import_attempts WHERE ip_hash = ? AND created_at >= ?) < 6 RETURNING key`)
      .bind(crypto.randomUUID(), ipHash, now, Math.floor(now / 60) * 60, dayStart, ipHash, Math.floor(now / 3600) * 3600),
  ]);
  if (!result.results.length) throw new ImportError(429, 'Grensen for nye lydhentinger er nådd. Prøv igjen senere, eller åpne en lagret økt.');
}

async function getImport(id: string, env: Bindings) {
  return env.IMPORTS.prepare('SELECT * FROM imports WHERE id = ?').bind(id).first<Import>();
}

async function finish(entry: Import, env: Bindings): Promise<Response> {
  if (entry.title && entry.store_id) return ready(entry);
  if (!entry.run_id) {
    if (Date.now() - entry.started_at > 60000) {
      await env.IMPORTS.prepare('DELETE FROM imports WHERE id = ? AND run_id IS NULL').bind(entry.id).run();
      throw new ImportError(502, 'Lydhentingen ble avbrutt. Prøv igjen.');
    }
    return pending(entry.id);
  }
  const { data: run } = await (await apify(`/actor-runs/${entry.run_id}?waitForFinish=15`, env)).json() as { data: { actId: string; status: string; defaultDatasetId: string; defaultKeyValueStoreId: string } };
  if (run.actId !== actor) throw new Error('Unexpected Actor');
  if (['READY', 'RUNNING'].includes(run.status)) return pending(entry.id);
  if (run.status === 'SUCCEEDED') {
    const rows = await (await apify(`/datasets/${run.defaultDatasetId}/items?clean=true&limit=2`, env)).json() as Array<{ videoId: string; status: string; title: string; format: string; fileSizeBytes: number; storageBackend: string; kvStoreKey: string; residentialProxyUsed: boolean }>;
    const row = rows[0];
    if (rows.length === 1 && row.videoId === entry.id && row.status === 'success' && row.format === 'MP3'
      && row.storageBackend === 'apify_kv' && row.kvStoreKey === `${entry.id}.mp3` && row.residentialProxyUsed === false
      && typeof row.title === 'string' && row.fileSizeBytes > 0 && row.fileSizeBytes <= 200 * 1024 * 1024
      && /^[\w]{17}$/.test(run.defaultKeyValueStoreId)) {
      entry.title = row.title.slice(0, 200); entry.store_id = run.defaultKeyValueStoreId;
      await env.IMPORTS.prepare('UPDATE imports SET title = ?, store_id = ? WHERE id = ? AND run_id = ?').bind(entry.title, entry.store_id, entry.id, entry.run_id).run();
      return ready(entry);
    }
  }
  await env.IMPORTS.prepare('DELETE FROM imports WHERE id = ? AND run_id = ?').bind(entry.id, entry.run_id).run();
  throw new ImportError(502, 'Denne videoen kunne ikke hentes. Prøv en annen lenke, eller åpne en lydfil.');
}

export async function hostedYoutubeAudio(request: Request, env: Bindings): Promise<Response> {
  try {
    if (!env.APIFY_TOKEN || !env.IMPORTS) throw new ImportError(503, 'Lydhenting er ikke tilgjengelig akkurat nå. Åpne en lydfil i stedet.');
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && path === '/api/youtube-audio') {
      if (request.headers.get('origin') !== new URL(request.url).origin) throw new ImportError(403, 'Åpne Omigjen for å hente lyd.');
      const id = await bodyId(request);
      let entry = await getImport(id, env);
      if (entry && Date.now() - entry.started_at < 6 * 86400000) return await finish(entry, env);
      await reserveImport(request, env);
      const now = Date.now();
      const inserted = await env.IMPORTS.prepare('INSERT INTO imports (id, started_at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET started_at = excluded.started_at, run_id = NULL, store_id = NULL, title = NULL WHERE started_at < ? RETURNING id').bind(id, now, now - 6 * 86400000).all();
      if (!inserted.results.length) return await finish((await getImport(id, env))!, env);
      let runId: string | undefined;
      try {
        const { data: run } = await (await apify(`/acts/${actor}/runs?maxTotalChargeUsd=0.50&timeout=300&build=0.0.65`, env, {
          method: 'POST', body: JSON.stringify({ urls: [{ url: `https://www.youtube.com/watch?v=${id}` }], format: 'mp3', residentialProxyMode: 'disabled' }),
        })).json() as { data: { id: string } };
        runId = run.id;
        if (!/^[\w]{17}$/.test(runId)) throw new Error('Unexpected run ID');
        await env.IMPORTS.prepare('UPDATE imports SET run_id = ? WHERE id = ? AND started_at = ?').bind(runId, id, now).run();
        entry = (await getImport(id, env))!;
      } catch (error) {
        if (runId) await apify(`/actor-runs/${runId}/abort`, env, { method: 'POST' }).catch(() => {});
        await env.IMPORTS.prepare('DELETE FROM imports WHERE id = ? AND started_at = ?').bind(id, now).run();
        throw error;
      }
      return pending(id);
    }
    const match = /^\/api\/youtube-audio\/([\w-]{11})(\.mp3)?$/.exec(path);
    if (request.method !== 'GET' || !match) throw new ImportError(404, 'Lydfilen finnes ikke.');
    const entry = await getImport(match[1], env);
    if (!entry || Date.now() - entry.started_at >= 6 * 86400000) throw new ImportError(404, 'Lydfilen har utløpt. Hent den på nytt.');
    if (!match[2]) return await finish(entry, env);
    if (!entry.title || !entry.store_id) throw new ImportError(409, 'Lydfilen er ikke klar ennå.');
    // Construct the provider URL ourselves; never follow a download URL supplied by an Actor.
    const audio = await apify(`/key-value-stores/${entry.store_id}/records/${entry.id}.mp3`, env);
    if (!audio.headers.get('content-type')?.startsWith('audio/mpeg') || Number(audio.headers.get('content-length')) > 200 * 1024 * 1024) throw new Error('Unexpected audio file');
    return new Response(audio.body, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) {
    if (!(error instanceof ImportError)) console.error('youtube-import-error', { name: error instanceof Error ? error.name : 'unknown', message: error instanceof Error ? error.message.replaceAll(env.APIFY_TOKEN || '[unset]', '[redacted]').slice(0, 200) : '' });
    return Response.json({ error: error instanceof ImportError ? error.message : 'Lyden kunne ikke hentes. Prøv igjen om litt.' }, {
      status: error instanceof ImportError ? error.status : 502, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
