import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const id = 'M7lc1UVf-VE';
const info = { id, title: 'Nedlastet slått', url: `/api/youtube-audio/${id}.mp3` };
async function openDownload(page: Page) {
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await page.getByRole('textbox', { name: 'YouTube-lenke' }).fill(`https://youtu.be/${id}`);
  await page.getByRole('button', { name: 'Hent lyd', exact: true }).click();
}
async function mockAudio(page: Page) {
  await page.route(`**${info.url}`, route => route.fulfill({ path: path.resolve('public/ovingsmelodi.wav'), contentType: 'audio/wav' }));
}

test('downloaded audio plays locally, preserves pitch, loops, and restores YouTube phrases', async ({ page }) => {
  await page.addInitScript(({ id }) => localStorage.setItem(`omigjen:phrases:yt:${id}`, JSON.stringify([{ id: 'saved', name: 'Gammelt øveparti', start: 0.3, end: 1.2, speed: 0.75 }])), { id });
  await page.route('**/api/youtube-audio', route => route.fulfill({ json: info }));
  await mockAudio(page);
  await page.goto('/');
  await openDownload(page);
  await expect(page.getByRole('heading', { name: info.title })).toBeVisible();
  await expect(page.locator('#song-meta')).toContainText('Lagret på denne enheten');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
  await page.locator('.phrase-button').filter({ hasText: 'Gammelt øveparti' }).click();
  expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => [el.playbackRate, el.preservesPitch, el.src.startsWith('blob:')])).toEqual([0.75, true, true]);
  await expect(page.locator('#rounds')).not.toHaveText('0 runder', { timeout: 5000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.reload();
  await openDownload(page);
  await expect(page.locator('.phrase-button').filter({ hasText: 'Gammelt øveparti' })).toBeVisible();
});

test('download failures show a retryable error without replacing the current tune', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/youtube-audio', route => ++attempts === 1
    ? route.fulfill({ status: 502, json: { error: 'Lyden kunne ikke hentes. Prøv igjen.' } })
    : route.fulfill({ json: info }));
  await mockAudio(page);
  await page.goto('/');
  await openDownload(page);
  await expect(page.locator('#source-error')).toContainText('Prøv igjen');
  await expect(page.getByRole('button', { name: 'Hent lyd', exact: true })).toBeEnabled();
  expect(await page.locator('#song-title').textContent()).toBe('En liten runddans');
  await page.getByRole('button', { name: 'Hent lyd', exact: true }).click();
  await expect(page.getByRole('heading', { name: info.title })).toBeVisible();
  expect(attempts).toBe(2);
});

test('closing the dialog cancels pending work so a late download cannot replace a newer source', async ({ page }) => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/youtube-audio', async route => { await pending; await route.fulfill({ json: info }).catch(() => {}); });
  await mockAudio(page);
  await page.goto('/');
  await openDownload(page);
  await expect(page.locator('#download-progress')).toBeVisible();
  await page.getByRole('button', { name: 'Avbryt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hent lyd', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Hent lyd', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await page.getByRole('button', { name: 'Prøv med øvingsmelodien' }).click();
  finish();
  await expect(page.getByRole('heading', { name: 'En liten runddans' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
  expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => el.src.endsWith('/ovingsmelodi.wav'))).toBe(true);
});
