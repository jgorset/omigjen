import { createHash } from 'node:crypto';
import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = process.platform === 'win32' ? 'yt-dlp.exe' : process.platform === 'darwin' ? 'yt-dlp_macos' : 'yt-dlp';
const base = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
console.log('Henter yt-dlp fra den offisielle GitHub-utgivelsen …');
const [binary, checksums] = await Promise.all([fetch(base + file), fetch(base + 'SHA2-256SUMS')]);
if (!binary.ok || !checksums.ok) throw new Error('Kunne ikke hente yt-dlp. Prøv igjen senere.');
const bytes = Buffer.from(await binary.arrayBuffer());
const expected = (await checksums.text()).split('\n').find(line => line.trim().endsWith(` ${file}`))?.split(/\s+/)[0];
if (!expected || createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Kontrollsummen for yt-dlp stemmer ikke.');
const tools = new URL('../.tools/', import.meta.url);
await mkdir(tools, { recursive: true });
const destination = new URL(file, tools);
await writeFile(destination, bytes);
if (process.platform !== 'win32') await chmod(destination, 0o755);
console.log(`yt-dlp er klar: ${fileURLToPath(destination)}\nFFmpeg må også finnes i PATH.`);
