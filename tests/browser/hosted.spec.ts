import { test, expect } from '@playwright/test';
import path from 'node:path';

test('public hosting still imports and retains local audio', async ({ page, request }) => {
  const origin = 'https://omigjen.johannesgorset.com';
  let apiRequests = 0;
  await page.route(`${origin}/**`, async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/')) apiRequests++;
    await route.fulfill({ response: await request.get(`http://127.0.0.1:5178${url.pathname}${url.search}`) });
  });
  await page.goto(origin);
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await expect(page.getByRole('textbox', { name: 'YouTube-lenke' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hent lyd', exact: true })).toBeVisible();
  await expect(page.locator('.or-divider')).toBeVisible();
  await page.locator('#audio-file').setInputFiles(path.resolve('public/ovingsmelodi.wav'));
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '75 %', exact: true }).click();
  await page.getByRole('button', { name: 'Lagre økt', exact: true }).click();
  await page.getByRole('textbox', { name: 'Navn på økten' }).fill('Lagret på nettsiden');
  await page.getByRole('button', { name: 'Lagre økten', exact: true }).click();
  await expect(page.locator('#session-save-dialog')).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Mine økter', exact: true }).click();
  await page.locator('.session-button').filter({ hasText: 'Lagret på nettsiden' }).click();
  await expect(page.locator('#playback-status')).toContainText('Økten er klar');
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => ({
    local: audio.src.startsWith('blob:'), rate: audio.playbackRate, preservesPitch: audio.preservesPitch,
  }))).toEqual({ local: true, rate: 0.75, preservesPitch: true });
  expect(apiRequests).toBe(0);
});
