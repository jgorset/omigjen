import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
}
async function time(page: Page, label: string, value: string) {
  const field = page.getByRole('textbox', { name: label, exact: true }); await field.fill(value); await field.press('Tab');
}
async function save(page: Page, name: string) {
  await page.getByRole('button', { name: 'Lagre økt', exact: true }).click();
  await page.getByRole('textbox', { name: 'Navn på økten' }).fill(name);
  await page.getByRole('button', { name: 'Lagre økten', exact: true }).click();
  await expect(page.locator('#session-save-dialog')).not.toBeVisible();
}

test('zoom animates, pans and leaves playback boundaries intact on desktop and mobile', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Zoom inn', exact: true }).click();
  // An intermediate viewport proves this is an actual animation, not only a final CSS state.
  const frames = await page.evaluate(() => new Promise<number[]>(resolve => {
    const samples: number[] = [];
    const started = performance.now();
    const sample = () => { samples.push(Number((document.querySelector('#seek') as HTMLInputElement).max)); if (performance.now() - started < 260) requestAnimationFrame(sample); else resolve(samples); };
    requestAnimationFrame(sample);
  }));
  expect(frames.some(value => value > 16.01 && value < 31.99)).toBe(true);
  await expect(page.locator('#seek')).toHaveAttribute('max', '16');
  await page.getByLabel('Flytt visning').fill('12');
  await expect(page.locator('#seek')).toHaveAttribute('min', '12');
  await expect(page.locator('#seek')).toHaveAttribute('max', '28');
  await expect(page.getByRole('textbox', { name: 'Starttid', exact: true })).toHaveValue('0:00.0');
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:08.0');
  await expect(page.locator('#start-handle')).toBeHidden();
  await expect(page.locator('#end-handle')).toBeHidden();
  await page.getByRole('button', { name: 'Zoom ut', exact: true }).click();
  await expect(page.locator('#seek')).toHaveAttribute('max', '32');
  await expect(page.locator('#timeline-navigation')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Zoom ut', exact: true })).toBeDisabled();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Zoom inn', exact: true }).click();
  await expect(page.locator('#seek')).toHaveAttribute('max', '16');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Zoom inn', exact: true }).click();
  await expect(page.locator('#seek')).toHaveAttribute('max', '0.25');
  await expect(page.getByRole('button', { name: 'Zoom inn', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Hele låten', exact: true }).click();
  await expect(page.locator('#seek')).toHaveAttribute('max', '32');
});

test('sessions retain imported audio and settings after reload, update in place, and export audio', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await page.locator('#audio-file').setInputFiles(path.resolve('public/ovingsmelodi.wav'));
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
  await time(page, 'Starttid', '0:03'); await time(page, 'Sluttid', '0:06');
  await page.getByRole('button', { name: '75 %', exact: true }).click();
  await page.getByLabel('Pusterom mellom rundene').selectOption('3');
  await page.getByRole('checkbox', { name: 'Spill i løkke', exact: true }).uncheck();
  await page.getByRole('slider', { name: 'Volum', exact: true }).fill('42');
  await page.getByRole('button', { name: 'Zoom inn', exact: true }).click();
  await expect(page.locator('#seek')).toHaveAttribute('max', '16');
  await page.getByLabel('Flytt visning').fill('2');
  await page.locator('audio').evaluate((a: HTMLAudioElement) => { a.currentTime = 4.25; });
  await page.getByRole('button', { name: 'Lagre valgt parti' }).click();
  await page.getByRole('textbox', { name: 'Navn på øvepartiet' }).fill('Andre veket');
  await page.getByRole('button', { name: 'Lagre øveparti', exact: true }).click();
  await page.getByRole('button', { name: 'Lagre økt', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Last ned lydfil', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('ovingsmelodi.wav');
  await page.getByRole('textbox', { name: 'Navn på økten' }).fill('Tirsdag <img src=x>');
  await page.getByRole('button', { name: 'Lagre økten', exact: true }).click();
  await expect(page.locator('#session-save-dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '50 %', exact: true }).click();
  await save(page, 'Tirsdag <img src=x>');
  await page.reload();
  await page.getByRole('button', { name: 'Mine økter', exact: true }).click();
  await expect(page.locator('.session-row')).toHaveCount(1);
  await expect(page.locator('#session-list img')).toHaveCount(0);
  await page.locator('.session-button').filter({ hasText: 'Tirsdag <img src=x>' }).click();
  await expect(page.locator('#sessions-dialog')).not.toBeVisible();
  await expect(page.locator('#playback-status')).toContainText('Økten er klar');
  await expect(page.getByRole('textbox', { name: 'Starttid', exact: true })).toHaveValue('0:03.0');
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:06.0');
  await expect(page.getByLabel('Pusterom mellom rundene')).toHaveValue('3');
  await expect(page.getByRole('checkbox', { name: 'Spill i løkke', exact: true })).not.toBeChecked();
  await expect(page.locator('#seek')).toHaveAttribute('min', '2');
  await expect(page.locator('#seek')).toHaveAttribute('max', '18');
  await expect(page.locator('.phrase-button').filter({ hasText: 'Andre veket' })).toBeVisible();
  const audio = await page.locator('audio').evaluate((a: HTMLAudioElement) => ({ rate: a.playbackRate, volume: a.volume, position: a.currentTime, local: a.src.startsWith('blob:'), paused: a.paused }));
  expect(audio).toMatchObject({ rate: 0.5, volume: 0.42, local: true, paused: true });
  expect(audio.position).toBeCloseTo(4.25, 1);
  await page.getByRole('button', { name: 'Spill', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(4.25);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Mine økter', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Slett økten Tirsdag <img src=x>', exact: true }).click();
  await expect(page.locator('#session-list')).toContainText('Ingen økter ennå');
  await page.reload();
  await page.getByRole('button', { name: 'Mine økter', exact: true }).click();
  await expect(page.locator('.session-row')).toHaveCount(0);
});

test('storage failure leaves a previously saved session intact and allows retry', async ({ page }) => {
  await ready(page);
  await save(page, 'Trygg økt');
  await page.getByRole('button', { name: '50 %', exact: true }).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      IDBObjectStore.prototype.put = original;
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: 'Lagre økt', exact: true }).click();
  await page.getByRole('button', { name: 'Lagre økten', exact: true }).click();
  await expect(page.locator('#session-save-error')).toContainText('ikke plass');
  await expect(page.getByRole('button', { name: 'Lagre økten', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Mine økter', exact: true }).click();
  await expect(page.locator('.session-button')).toContainText('100 %');
  await page.keyboard.press('Escape');
  await save(page, 'Trygg økt');
  await page.getByRole('button', { name: 'Mine økter', exact: true }).click();
  await expect(page.locator('.session-row')).toHaveCount(1);
  await expect(page.locator('.session-button')).toContainText('50 %');
});
