import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
}
async function setTime(page: Page, label: string, time: string) {
  const field = page.getByRole('textbox', { name: label, exact: true });
  await field.fill(time); await field.press('Tab');
}

test('practice shortcuts keep working after button clicks without taking over text entry', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '75 %', exact: true }).click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.keyboard.press('l');
  await expect(page.getByRole('checkbox', { name: 'Spill i løkke', exact: true })).not.toBeChecked();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lagre valgt parti' }).click();
  const name = page.getByRole('textbox', { name: 'Navn på øvepartiet' });
  await name.pressSequentially('Ballade A B');
  await expect(name).toHaveValue('Ballade A B');
  expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
});

test('marking at the playhead can select a new phrase beyond either old boundary', async ({ page }) => {
  await ready(page);
  await page.locator('audio').evaluate((el: HTMLAudioElement) => { el.currentTime = 20; });
  await page.getByRole('button', { name: 'Sett A her' }).click();
  await expect(page.getByRole('textbox', { name: 'Starttid', exact: true })).toHaveValue('0:20.0');
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:28.0');
  await page.locator('audio').evaluate((el: HTMLAudioElement) => { el.currentTime = 5; });
  await page.keyboard.press('b');
  await expect(page.getByRole('textbox', { name: 'Starttid', exact: true })).toHaveValue('0:00.0');
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:05.0');
  await page.locator('audio').evaluate((el: HTMLAudioElement) => { el.currentTime = 32; });
  await page.keyboard.press('a');
  await expect(page.getByRole('textbox', { name: 'Starttid', exact: true })).toHaveValue('0:31.8');
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:32.0');
});

test('a late failure from a replaced audio source does not stop the current player', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    let first = true;
    HTMLMediaElement.prototype.play = function () {
      if (!first) return original.call(this);
      first = false;
      return new Promise((_, reject) => setTimeout(() => reject(new DOMException('Old source interrupted', 'AbortError')), 1500));
    };
  });
  await ready(page);
  await page.getByRole('button', { name: 'Spill', exact: true }).click();
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await page.locator('#audio-file').setInputFiles(path.resolve('public/ovingsmelodi.wav'));
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Spill', exact: true }).click();
  await page.waitForTimeout(1700);
  expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(page.locator('#message')).toBeHidden();
});

test('demo really plays, preserves pitch, changes speed and repeats the selected audio', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page);
  await expect(page.locator('#duration')).toHaveText('0:32');
  await page.getByRole('button', { name: '75 %', exact: true }).click();
  expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => [el.playbackRate, el.preservesPitch])).toEqual([0.75, true]);
  await setTime(page, 'Sluttid', '0:01.2');
  await setTime(page, 'Starttid', '0:00.3');
  await page.getByRole('button', { name: 'Spill', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime)).toBeGreaterThan(0.3);
  await expect(page.locator('#rounds')).not.toHaveText('0 runder', { timeout: 5000 });
  const position = await page.locator('audio').evaluate((el: HTMLAudioElement) => el.currentTime);
  expect(position).toBeGreaterThanOrEqual(0.25); expect(position).toBeLessThan(1.3);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  expect(errors).toEqual([]);
});

test('saved phrases restore after reload, keep names as text, and can be deleted', async ({ page }) => {
  await ready(page);
  await setTime(page, 'Sluttid', '0:04.5');
  await page.getByRole('button', { name: '50 %', exact: true }).click();
  await page.getByRole('button', { name: 'Lagre valgt parti' }).click();
  await page.getByRole('textbox', { name: 'Navn på øvepartiet' }).fill('Andre veket <img src=x>');
  await page.getByRole('button', { name: 'Lagre øveparti', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
  const phrase = page.locator('.phrase-button').filter({ hasText: 'Andre veket <img src=x>' });
  await expect(phrase).toBeVisible();
  await phrase.click();
  await expect(page.locator('#speed-value')).toHaveText('50%');
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:04.5');
  await expect(page.locator('#phrase-list img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Slett Andre veket <img src=x>', exact: true }).click();
  await page.reload();
  await expect(phrase).toHaveCount(0);
});

test('pausing during the rest cancels restart, and changing source clears pending audio', async ({ page }) => {
  await ready(page);
  await setTime(page, 'Sluttid', '0:00.4');
  await page.getByLabel('Pusterom mellom rundene').selectOption('1');
  await page.getByRole('button', { name: 'Spill', exact: true }).click();
  await expect(page.locator('#playback-status')).toContainText('Pusterom');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForTimeout(1250);
  expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Spill', exact: true }).click();
  await expect(page.locator('#playback-status')).toContainText('Pusterom');
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await page.locator('#audio-file').setInputFiles(path.resolve('public/ovingsmelodi.wav'));
  await expect(page.getByRole('heading', { name: 'ovingsmelodi', exact: true })).toBeVisible();
  await page.waitForTimeout(1250);
  expect(await page.locator('audio').evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  await expect(page.locator('#phrase-count')).toHaveText('0');
});

test('input validation, marker keyboard access and source dialog work on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#end-handle').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:07.9');
  await setTime(page, 'Starttid', '0:10');
  await expect(page.locator('#message')).toContainText('Slutten må');
  await expect(page.getByRole('textbox', { name: 'Starttid', exact: true })).toHaveValue('0:00.0');
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await page.getByRole('textbox', { name: 'YouTube-lenke' }).fill('https://youtube.com.evil.example/watch?v=M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Hent lyd', exact: true }).click();
  await expect(page.locator('#source-error')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#source-dialog')).not.toBeVisible();
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('desktop layout and upload failure recover without a reload', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#waveform')).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await page.locator('#audio-file').setInputFiles({ name: 'broken.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('not audio') });
  await expect(page.locator('#message')).toContainText(/kunne ikke/);
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Åpne en låt' }).click();
  await page.getByRole('button', { name: 'Prøv med øvingsmelodien' }).click();
  await expect(page.getByRole('button', { name: 'Spill', exact: true })).toBeEnabled();
});

test('zooming makes a small phrase editable without changing its playback boundaries', async ({ page }) => {
  await ready(page);
  await setTime(page, 'Starttid', '0:03');
  await setTime(page, 'Sluttid', '0:03.5');
  await page.getByRole('button', { name: 'Forstørr parti' }).click();
  await expect(page.getByRole('button', { name: 'Hele låten', exact: true })).toBeVisible();
  await expect(page.locator('#seek')).toHaveAttribute('min', '2.5');
  await expect(page.locator('#seek')).toHaveAttribute('max', '4');
  await expect(page.getByRole('textbox', { name: 'Starttid', exact: true })).toHaveValue('0:03.0');
  await page.locator('#end-handle').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:03.6');
  await page.getByRole('button', { name: 'Hele låten', exact: true }).click();
  await expect(page.locator('#seek')).toHaveAttribute('max', '32');
  const handle = await page.locator('#end-handle').boundingBox();
  const timeline = await page.locator('#timeline').boundingBox();
  expect(handle).not.toBeNull(); expect(timeline).not.toBeNull();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 30);
  await page.mouse.down();
  await page.mouse.move(timeline!.x + timeline!.width / 2, handle!.y + 30, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('textbox', { name: 'Sluttid', exact: true })).toHaveValue('0:16.0');
});
