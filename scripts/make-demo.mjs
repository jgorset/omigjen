import { mkdirSync, writeFileSync } from 'node:fs';

// An original, synthesized practice phrase. No third-party recording is used.
const sampleRate = 22050;
const duration = 32;
const samples = new Float32Array(sampleRate * duration);
const melody = [62, 66, 69, 66, 64, 67, 71, 69, 66, 64, 62, 64, 66, 69, 62, 62,
  69, 71, 74, 71, 69, 67, 66, 64, 67, 66, 64, 69, 66, 64, 62, 62];
function note(midi, at, length, volume) {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  for (let i = 0; i < length * sampleRate; i++) {
    const index = Math.round(at * sampleRate) + i;
    if (index >= samples.length) break;
    const t = i / sampleRate;
    const envelope = Math.min(t / 0.008, 1) * Math.exp(-t * 5) * Math.min((length - t) / 0.04, 1);
    samples[index] += volume * envelope * (Math.sin(2 * Math.PI * frequency * t)
      + 0.25 * Math.sin(4 * Math.PI * frequency * t) + 0.1 * Math.sin(6 * Math.PI * frequency * t));
  }
}
for (let i = 0; i < 64; i++) {
  note(melody[i % melody.length], i * 0.5, 0.48, 0.42);
  if (i % 2 === 0) note(i % 16 < 8 ? 38 : 45, i * 0.5, 0.9, 0.13);
}
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
samples.forEach((s, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
mkdirSync('public', { recursive: true });
writeFileSync('public/ovingsmelodi.wav', wav);
