import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, parseTime, readPhrases, waveformPeaks, youtubeId } from '../src/core.ts';

test('time entry and display handle decimal commas, minute boundaries and invalid input', () => {
  assert.equal(parseTime('1:02,5'), 62.5);
  assert.equal(parseTime('12.25'), 12.25);
  assert.equal(parseTime('1:60'), null);
  assert.equal(parseTime('-2'), null);
  assert.equal(parseTime('Infinity'), null);
  assert.equal(formatTime(59.96, true), '1:00.0');
  assert.equal(formatTime(NaN), '0:00');
});

test('YouTube input accepts real video URL forms and rejects lookalike hosts and other schemes', () => {
  for (const url of ['https://www.youtube.com/watch?v=M7lc1UVf-VE&t=25', 'https://youtu.be/M7lc1UVf-VE', 'https://m.youtube.com/shorts/M7lc1UVf-VE', 'https://youtube.com/live/M7lc1UVf-VE']) assert.equal(youtubeId(url), 'M7lc1UVf-VE');
  for (const url of ['https://youtube.com.evil.example/watch?v=M7lc1UVf-VE', 'https://youtube.com/playlist?list=foo', 'https://spotify.com/track/abc', 'javascript:alert(1)', 'ftp://youtube.com/watch?v=M7lc1UVf-VE', 'https://youtube.com/watch?v=bad']) assert.equal(youtubeId(url), null);
});

test('saved data validation rejects malformed and impossible loops', () => {
  assert.deepEqual(readPhrases('{bad'), []);
  assert.deepEqual(readPhrases('{}'), []);
  const valid = { id: 'one', name: 'First phrase', start: 0, end: 8, speed: 0.75 };
  assert.deepEqual(readPhrases(JSON.stringify([null, valid, { ...valid, start: -1 }, { ...valid, end: 0 }, { ...valid, speed: 0 }])), [valid]);
  const silent = waveformPeaks(new Float32Array(1000));
  assert.equal(silent.length, 2048);
  assert.ok(silent.every(value => value === 0));
  assert.equal(Math.max(...waveformPeaks(new Float32Array([0, 0.5, -1, 0.25]), 4)), 1);
});
