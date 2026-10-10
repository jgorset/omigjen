import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';
import { hostedYoutubeAudio } from '../server/hosted-youtube.ts';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_imports.sql', import.meta.url), 'utf8'));
  const IMPORTS = {
    prepare(sql: string) {
      let values: Array<string | number> = [];
      const statement = {
        bind(...args: Array<string | number>) { values = args; return statement; },
        async first() { return sqlite.prepare(sql).get(...values) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...values), success: true }; },
        async run() { return { results: [], success: true, meta: sqlite.prepare(sql).run(...values) }; },
      };
      return statement;
    },
    async batch(statements: Array<{ all(): Promise<unknown> }>) {
      sqlite.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.all()); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  return { sqlite, env: { IMPORTS, APIFY_TOKEN: 'apify_api_test' } };
}
const origin = 'https://omigjen.johannesgorset.com';
function post(id: string, ip = '192.0.2.1') {
  return new Request(`${origin}/api/youtube-audio`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify({ id }) });
}

test('hosted imports reject unsafe inputs before spending credit', async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not contact provider'); });
  const crossOrigin = post('jNQXAC9IVRw'); crossOrigin.headers.set('Origin', 'https://example.com');
  assert.equal((await hostedYoutubeAudio(crossOrigin, env)).status, 403);
  assert.equal((await hostedYoutubeAudio(post('https://evil.test/audio'), env)).status, 400);
  const oversized = new Request(`${origin}/api/youtube-audio`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: 'x'.repeat(1025) });
  assert.equal((await hostedYoutubeAudio(oversized, env)).status, 413);
  assert.equal((await hostedYoutubeAudio(new Request(`${origin}/api/youtube-audio/../../admin`), env)).status, 404);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM imports').get()?.n, 0);
});

test('completed imports reuse one capped job and stream only its expected audio record', async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const id = 'jNQXAC9IVRw'; const run = '11111111111111111'; const store = '22222222222222222';
  let started = 0;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(String(input)); assert.equal(url.origin, 'https://api.apify.com');
    assert.equal(options?.redirect, 'manual');
    if (url.pathname.endsWith('/runs')) {
      started++;
      assert.equal(url.searchParams.get('maxTotalChargeUsd'), '0.50');
      assert.equal(url.searchParams.get('timeout'), '300');
      assert.deepEqual(JSON.parse(options?.body as string), { urls: [{ url: `https://www.youtube.com/watch?v=${id}` }], format: 'mp3', residentialProxyMode: 'disabled' });
      return Response.json({ data: { id: run } });
    }
    if (url.pathname === `/v2/actor-runs/${run}`) return Response.json({ data: { actId: 'ZSKNl5eniyeAPcPkf', status: 'SUCCEEDED', defaultDatasetId: 'dataset', defaultKeyValueStoreId: store } });
    if (url.pathname.endsWith('/items')) return Response.json([{ videoId: id, status: 'success', title: 'A tune', format: 'MP3', fileSizeBytes: 3, storageBackend: 'apify_kv', kvStoreKey: `${id}.mp3`, residentialProxyUsed: false, downloadUrl: 'https://evil.test/ignored' }]);
    assert.equal(url.pathname, `/v2/key-value-stores/${store}/records/${id}.mp3`);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '3' } });
  });
  assert.equal((await hostedYoutubeAudio(post(id), env)).status, 202);
  const complete = await hostedYoutubeAudio(new Request(`${origin}/api/youtube-audio/${id}`), env);
  assert.equal(complete.status, 200);
  assert.deepEqual(await complete.json(), { id, title: 'A tune', url: `/api/youtube-audio/${id}.mp3` });
  assert.equal((await hostedYoutubeAudio(post(id), env)).status, 200);
  assert.equal(started, 1);
  const audio = await hostedYoutubeAudio(new Request(`${origin}/api/youtube-audio/${id}.mp3`), env);
  assert.deepEqual([...new Uint8Array(await audio.arrayBuffer())], [1, 2, 3]);
});

test('connection and shared daily limits prevent new paid jobs', async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  let now = Date.UTC(2026, 9, 10, 12); let started = 0;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => { started++; return Response.json({ data: { id: String(started).padStart(17, '0') } }); });
  for (let i = 0; i < 6; i++) {
    assert.equal((await hostedYoutubeAudio(post(`video${String(i).padStart(6, '0')}`), env)).status, 202);
    now += 61000;
  }
  assert.equal((await hostedYoutubeAudio(post('blocked0000'), env)).status, 429);
  assert.equal(started, 6);
  // Rejected connection requests must not drain the shared allowance.
  for (let i = 0; i < 14; i++) {
    now += 61000;
    assert.equal((await hostedYoutubeAudio(post(`other${String(i).padStart(6, '0')}`, `192.0.2.${i + 2}`), env)).status, 202);
  }
  now += 61000;
  assert.equal((await hostedYoutubeAudio(post('blocked0001', '192.0.2.100'), env)).status, 429);
  assert.equal(started, 20);
});

test('provider failures release the import so it can be retried', async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const id = 'jNQXAC9IVRw'; let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++calls === 1) return Response.json({ error: { type: 'monthly-usage-limit-exceeded' } }, { status: 403 });
    return Response.json({ data: { id: '11111111111111111' } });
  });
  assert.equal((await hostedYoutubeAudio(post(id), env)).status, 503);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM imports').get()?.n, 0);
  assert.equal((await hostedYoutubeAudio(post(id), env)).status, 202);
});

test('provider quota, busy and download errors return useful messages', async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  let providerStatus = 402; let code = 'not-enough-usage-to-run-paid-actor';
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { type: code } }, { status: providerStatus }));
  for (const [status, type, expected, message] of [
    [402, 'not-enough-usage-to-run-paid-actor', 503, 'kvoten'],
    [403, 'limit-reached', 503, 'kvoten'],
    [429, 'rate-limit-exceeded', 429, 'Prøv igjen om litt'],
    [403, 'concurrent-runs-limit-exceeded', 429, 'Prøv igjen om litt'],
    [500, 'internal-server-error', 502, 'åpne en lydfil'],
    [302, 'redirect', 502, 'åpne en lydfil'],
  ] as const) {
    providerStatus = status; code = type;
    const response = await hostedYoutubeAudio(post('jNQXAC9IVRw'), env);
    assert.equal(response.status, expected);
    assert.match((await response.json()).error, new RegExp(message));
    assert.equal(sqlite.prepare('SELECT count(*) AS n FROM imports').get()?.n, 0);
    now += 61000;
  }
});

test('a failed provider run returns an error and allows a new attempt', async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  sqlite.prepare('INSERT INTO imports (id, started_at, run_id) VALUES (?, ?, ?)').run('jNQXAC9IVRw', Date.now(), '11111111111111111');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: { actId: 'ZSKNl5eniyeAPcPkf', status: 'FAILED' } }));
  const response = await hostedYoutubeAudio(new Request(`${origin}/api/youtube-audio/jNQXAC9IVRw`), env);
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Prøv en annen lenke/);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM imports').get()?.n, 0);
});
