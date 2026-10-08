import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { youtubeAudioMiddleware } from '../server/youtube-audio.ts';

test('local audio API validates requests, reuses saved downloads, and serves seek ranges', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'omigjen-audio-'));
  let middleware = youtubeAudioMiddleware(root);
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); });
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const post = (body: string, headers = {}) => fetch(`${base}/api/youtube-audio`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  assert.equal((await post('{bad')).status, 400);
  assert.equal((await post('{"id":"../../secret"}')).status, 400);
  assert.equal((await post('null')).status, 400);
  assert.equal((await post('x'.repeat(1025))).status, 413);
  assert.equal((await post('{"id":"M7lc1UVf-VE"}', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('{}', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await fetch(`${base}/api/youtube-audio/xxxxxxxxxxx.mp3`)).status, 404);

  const cache = path.join(root, '.cache', 'youtube');
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, 'M7lc1UVf-VE.mp3'), '0123456789');
  await writeFile(path.join(cache, 'M7lc1UVf-VE.json'), JSON.stringify({ id: 'M7lc1UVf-VE', title: 'Lagret opptak' }));
  // A cached download works without yt-dlp installed and survives a new middleware instance.
  for (let i = 0; i < 2; i++) {
    middleware = youtubeAudioMiddleware(root);
    const response = await post('{"id":"M7lc1UVf-VE"}');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 'M7lc1UVf-VE', title: 'Lagret opptak', url: '/api/youtube-audio/M7lc1UVf-VE.mp3' });
  }
  const url = `${base}/api/youtube-audio/M7lc1UVf-VE.mp3`;
  assert.equal(await (await fetch(url)).text(), '0123456789');
  for (const [range, text, contentRange] of [['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=7-', '789', 'bytes 7-9/10'], ['bytes=-3', '789', 'bytes 7-9/10']]) {
    const response = await fetch(url, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), contentRange);
    assert.equal(await response.text(), text);
  }
  for (const range of ['bytes=20-', 'bytes=8-4', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4']) {
    const response = await fetch(url, { headers: { Range: range } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */10');
  }
  const head = await fetch(url, { method: 'HEAD' });
  assert.equal(head.headers.get('Content-Length'), '10');
  assert.equal(await head.text(), '');
});
