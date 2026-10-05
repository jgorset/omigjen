import '@phosphor-icons/web/regular';
import './style.css';
import { clamp, formatTime, MIN_LOOP, parseTime, readPhrases, waveformPeaks, youtubeId, type Phrase } from './core';
import { loadYouTube, type YouTubePlayer } from './youtube';

const icon = (name: string) => `<i class="ph ph-${name}" aria-hidden="true"></i>`;
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="./" aria-label="Omigjen, ditt øverom">${icon('arrows-clockwise')}omigjen<span class="brand-period">.</span></a>
    <span class="header-note">Et lite rom for å bli bedre.</span>
    <button class="btn help-button" id="help-open">${icon('keyboard')}<span>Snarveier</span></button>
  </header>
  <main>
    <div class="intro"><span class="eyebrow">DITT ØVEROM</span><p>Lytt. Senk tempoet. Spill med.</p></div>
    <div class="song-heading">
      <div class="song-identity"><div class="song-symbol">${icon('music-notes-simple')}</div><div><h1 id="song-title">En liten runddans</h1><p id="song-meta">Innebygd demo · Syntetisk øvingsmelodi</p></div></div>
      <button class="btn source-button" id="source-open">${icon('plus')}Åpne en låt</button>
    </div>
    <div class="workspace">
      <section class="player-panel" aria-label="Øvingsspiller">
        <div id="youtube-section" hidden><div class="video-wrap"><div id="youtube-host"></div></div><p class="video-note">YouTube styrer tilgjengelige hastigheter. Korte løkker kan ha et lite opphold.</p></div>
        <div class="timeline-heading"><span class="eyebrow" id="timeline-label">LYDBILDE</span><div class="timeline-tools"><button class="btn zoom-button" id="zoom" disabled>${icon('magnifying-glass-plus')} Forstørr parti</button><span id="source-kind">${icon('waveform')} Lokal avspilling</span></div></div>
        <div class="timeline" id="timeline" style="--a: 0%; --b: 25%; --playhead: 0%">
          <div class="loop-shade" id="loop-shade"></div>
          <canvas id="waveform" aria-hidden="true"></canvas>
          <div id="timeline-empty" hidden>Tidslinje for video</div>
          <input id="seek" type="range" min="0" max="32" value="0" step="0.01" aria-label="Spilleposisjon" />
          <div class="playhead" id="playhead"></div>
          <div class="loop-handle start-handle" id="start-handle" role="slider" tabindex="0" aria-label="Start på øveparti" aria-valuemin="0" aria-valuemax="32" aria-valuenow="0"><span>A</span></div>
          <div class="loop-handle end-handle" id="end-handle" role="slider" tabindex="0" aria-label="Slutt på øveparti" aria-valuemin="0" aria-valuemax="32" aria-valuenow="8"><span>B</span></div>
        </div>
        <div class="ruler" id="ruler" aria-hidden="true"></div>
        <div class="timeline-hint"><span>${icon('hand-pointing')} Dra A og B for å velge et parti</span><span id="selected-length">8,0 sek valgt</span></div>
        <div class="transport">
          <div class="time-display"><span id="current-time">0:00.0</span><span class="time-divider">/</span><span id="duration">0:32</span></div>
          <div class="transport-buttons">
            <button class="btn transport-small" id="restart" aria-label="Til starten av øvepartiet" title="Til starten av øvepartiet">${icon('skip-back')}</button>
            <button class="btn btn-primary play-button" id="play" aria-label="Spill" disabled>${icon('play')}</button>
            <button class="btn transport-small" id="back" aria-label="Spol to sekunder tilbake" title="To sekunder tilbake">${icon('rewind')}<span>2s</span></button>
          </div>
          <div class="volume-control">${icon('speaker-high')}<input class="range range-xs" id="volume" aria-label="Volum" type="range" min="0" max="100" value="80" /></div>
        </div>
        <div class="playback-status"><span id="playback-status" role="status">Gjør klar øvingsmelodien …</span><span id="rounds">0 runder</span></div>
        <div class="settings-grid">
          <section class="tempo-section" aria-labelledby="tempo-heading">
            <div class="section-heading"><h2 id="tempo-heading">${icon('gauge')} Tempo</h2><span class="speed-value" id="speed-value">100<span>%</span></span></div>
            <div class="speed-slider"><button class="btn adjust-button" id="slower" aria-label="Saktere">${icon('minus')}</button><input class="range range-sm" type="range" id="speed" min="25" max="200" step="5" value="100" aria-label="Tempo i prosent" /><button class="btn adjust-button" id="faster" aria-label="Raskere">${icon('plus')}</button></div>
            <div class="speed-presets"><button class="btn" data-speed="0.5">50 %</button><button class="btn" data-speed="0.75">75 %</button><button class="btn selected" data-speed="1">Original</button></div>
            <p class="setting-note" id="pitch-note">${icon('music-note')} Samme tonehøyde, ditt tempo.</p>
          </section>
          <section class="loop-section" aria-labelledby="loop-heading">
            <div class="section-heading"><h2 id="loop-heading">${icon('arrows-clockwise')} Spill i løkke</h2><input class="toggle" id="loop-enabled" type="checkbox" checked aria-label="Spill i løkke" /></div>
            <div class="loop-times">
              <label><span><b>A</b> Start</span><input class="input" id="loop-start" value="0:00.0" aria-label="Starttid" inputmode="decimal" spellcheck="false" /></label>
              <span class="time-arrow">${icon('arrow-right')}</span>
              <label><span><b>B</b> Slutt</span><input class="input" id="loop-end" value="0:08.0" aria-label="Sluttid" inputmode="decimal" spellcheck="false" /></label>
            </div>
            <div class="mark-buttons"><button class="btn" id="mark-start">Sett A her <kbd>A</kbd></button><button class="btn" id="mark-end">Sett B her <kbd>B</kbd></button></div>
          </section>
        </div>
        <div class="pause-row"><div>${icon('hourglass-medium')}<label for="gap">Pusterom mellom rundene</label></div><select id="gap" class="input"><option value="0">Ingen pause</option><option value="1">1 sekund</option><option value="2">2 sekunder</option><option value="3">3 sekunder</option><option value="5">5 sekunder</option></select></div>
      </section>
      <aside class="phrases-panel" aria-labelledby="phrases-heading">
        <div class="phrases-heading"><div><span class="eyebrow">BIT FOR BIT</span><h2 id="phrases-heading">Mine øvepartier</h2></div><span class="phrase-count" id="phrase-count">0</span></div>
        <p class="aside-description">Ta vare på partiene du vil tilbake til.</p>
        <div id="phrase-list"></div>
        <button class="btn save-button" id="save-phrase">${icon('plus')} Lagre valgt parti</button>
        <div class="practice-tip"><span class="tip-icon">${icon('ear')}</span><h3>La øret lede an.</h3><p>Begynn med noen få toner. Spill dem sakte til de sitter, og ta litt mer neste gang.</p></div>
        <p class="storage-note">${icon('device-laptop')} Øvepartiene huskes i denne nettleseren.</p>
      </aside>
    </div>
    <div class="message" id="message" role="alert" hidden></div>
    <footer><span>En frase. En gang til.</span><div><kbd>mellomrom</kbd> spill / pause <span class="footer-separator">/</span> <kbd>A</kbd><kbd>B</kbd> marker parti</div></footer>
  </main>
  <audio id="audio" preload="auto"></audio>
  <dialog class="modal" id="source-dialog">
    <div class="modal-box source-modal">
      <div class="dialog-heading"><span class="eyebrow">FINN NOE Å ØVE PÅ</span><button class="btn close-dialog" aria-label="Lukk" data-close="source-dialog">${icon('x')}</button></div>
      <h2>Din neste låt.</h2><p>Lim inn en YouTube-lenke, eller åpne en lydfil.</p>
      <form id="youtube-form"><label for="youtube-url">YouTube-lenke</label><div class="url-row"><input class="input" id="youtube-url" type="url" placeholder="https://www.youtube.com/watch?v=…" required /><button class="btn" type="submit">Åpne ${icon('arrow-up-right')}</button></div><p class="source-disclosure">Videoen spilles fra YouTube når du åpner lenken.</p><p class="form-error" id="source-error" role="alert" hidden></p></form>
      <div class="or-divider"><span>eller fra enheten din</span></div>
      <label class="file-drop" id="file-drop" for="audio-file">${icon('upload-simple')}<strong>Velg en lydfil</strong><span>eller slipp den her</span><small>MP3, WAV, M4A, OGG og FLAC hvis nettleseren støtter det</small><input id="audio-file" type="file" accept="audio/*,.m4a,.flac,.ogg,.wav,.mp3" /></label>
      <p class="file-privacy">${icon('lock-simple')} Lydfilen blir på enheten din.</p>
      <button class="btn demo-button" id="load-demo">${icon('music-notes-simple')} Prøv med øvingsmelodien</button>
      <details class="source-details"><summary>Hva med Spotify?</summary><p>Spotify tilbyr ikke tempojustering gjennom avspillingsverktøyene sine. Bruk en YouTube-versjon eller en lydfil du har tilgang til.</p></details>
    </div><form method="dialog" class="modal-backdrop"><button>Lukk</button></form>
  </dialog>
  <dialog class="modal" id="save-dialog"><div class="modal-box"><div class="dialog-heading"><span class="eyebrow">TA VARE PÅ ET PARTI</span><button class="btn close-dialog" data-close="save-dialog" aria-label="Lukk">${icon('x')}</button></div><h2>Lett å finne igjen.</h2><p id="save-description"></p><form id="save-form"><label for="phrase-name">Navn på øvepartiet</label><input class="input" id="phrase-name" maxlength="80" required placeholder="For eksempel: Andre veket" /><button class="btn save-confirm" type="submit">Lagre øveparti ${icon('check')}</button></form></div><form method="dialog" class="modal-backdrop"><button>Lukk</button></form></dialog>
  <dialog class="modal" id="help-dialog"><div class="modal-box"><div class="dialog-heading"><span class="eyebrow">HENDENE PÅ INSTRUMENTET</span><button class="btn close-dialog" data-close="help-dialog" aria-label="Lukk">${icon('x')}</button></div><h2>Noen små snarveier.</h2><dl class="shortcut-list"><div><dt><kbd>Mellomrom</kbd></dt><dd>Spill eller pause</dd></div><div><dt><kbd>A</kbd> / <kbd>B</kbd></dt><dd>Sett start eller slutt her</dd></div><div><dt><kbd>L</kbd></dt><dd>Slå løkka av eller på</dd></div><div><dt><kbd>←</kbd> / <kbd>→</kbd></dt><dd>Spol to sekunder</dd></div></dl><p>Dra A og B over lydbildet, eller skriv inn nøyaktige tider. Når en markør er valgt, flytter piltastene den med et tidels sekund.</p><p>Lydfiler og lagrede partier blir på denne enheten. Åpne samme fil igjen for å hente fram partiene dine.</p></div><form method="dialog" class="modal-backdrop"><button>Lukk</button></form></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const audio = $<HTMLAudioElement>('audio');
const canvas = $<HTMLCanvasElement>('waveform');
const seekInput = $<HTMLInputElement>('seek');
const speedInput = $<HTMLInputElement>('speed');
const loopToggle = $<HTMLInputElement>('loop-enabled');
let player: YouTubePlayer | null = null;
let source: 'file' | 'youtube' = 'file';
let sourceKey = 'demo';
let sourceVersion = 0;
let objectUrl: string | null = null;
let duration = 32;
let viewStart = 0;
let viewEnd = 32;
let zoomed = false;
let start = 0;
let end = 8;
let speed = 1;
let rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
let playing = false;
let playRequest = 0;
let ready = false;
let looping = true;
let rounds = 0;
let gap = 0;
let gapTimer: ReturnType<typeof setTimeout> | null = null;
let gapUntil = 0;
let seekLockUntil = 0;
let peaks: number[] = [];
let phrases: Phrase[] = [];
let activePhrase: string | null = null;
let ytReadyTimeout: ReturnType<typeof setTimeout> | null = null;

function message(text: string) { $('message').textContent = text; $('message').hidden = !text; }
function status(text: string) { if ($('playback-status').textContent !== text) $('playback-status').textContent = text; }
function currentTime() { return source === 'file' ? audio.currentTime || 0 : player?.getCurrentTime?.() || 0; }
function storageKey() { return `omigjen:phrases:${sourceKey}`; }
function restorePhrases() {
  try { phrases = readPhrases(localStorage.getItem(storageKey())); } catch { phrases = []; }
  if (sourceKey === 'demo' && !phrases.length) {
    // Demo suggestions are examples attached only to the built-in melody.
    let hasSaved = false;
    try { hasSaved = localStorage.getItem(storageKey()) !== null; } catch { /* Storage is optional. */ }
    if (!hasSaved) phrases = [{ id: 'demo-a', name: 'Første frase', start: 0, end: 8, speed: 0.75 }, { id: 'demo-b', name: 'Andre frase', start: 8, end: 16, speed: 0.75 }];
  }
  renderPhrases();
}
function persistPhrases() {
  try { localStorage.setItem(storageKey(), JSON.stringify(phrases)); }
  catch { message('Nettleseren kunne ikke lagre øvepartiene. De virker fortsatt fram til du lukker siden.'); }
}
function cancelGap() { if (gapTimer !== null) clearTimeout(gapTimer); gapTimer = null; gapUntil = 0; }
function setPlaying(value: boolean) {
  playing = value;
  $('play').innerHTML = icon(value ? 'pause' : 'play');
  $('play').setAttribute('aria-label', value ? 'Pause' : 'Spill');
  document.body.classList.toggle('is-playing', value);
}
function pause() {
  playRequest++;
  cancelGap();
  if (source === 'file') audio.pause(); else player?.pauseVideo?.();
  setPlaying(false);
  status('Ta den tiden du trenger.');
}
async function play() {
  if (!ready) return;
  const request = ++playRequest;
  cancelGap();
  if (looping && (currentTime() < start || currentTime() >= end - 0.03)) seek(start);
  else if (!looping && currentTime() >= duration - 0.03) seek(0);
  try {
    if (source === 'file') await audio.play(); else player?.playVideo();
  } catch (error) {
    if (request !== playRequest || (error instanceof DOMException && error.name === 'AbortError')) return;
    setPlaying(false); message('Avspillingen kunne ikke starte. Trykk på spill for å prøve igjen.');
  }
}
function seek(time: number) {
  if (!ready) return;
  const value = clamp(time, 0, duration);
  if (source === 'file') audio.currentTime = value; else player?.seekTo(value, true);
  seekLockUntil = performance.now() + (source === 'youtube' ? 500 : 60);
  renderPosition(value);
}
function togglePlay() { if (playing || gapTimer !== null) pause(); else void play(); }
function resetRounds() { rounds = 0; $('rounds').textContent = '0 runder'; }
function loopBack() {
  if (gapTimer !== null || !looping || !ready) return;
  rounds += 1;
  $('rounds').textContent = `${rounds} ${rounds === 1 ? 'runde' : 'runder'}`;
  if (gap > 0) {
    gapUntil = performance.now() + gap * 1000;
    // Assign the timer before pausing; media pause events must not cancel the wait.
    gapTimer = setTimeout(() => {
      gapTimer = null; gapUntil = 0;
      seek(start); void play();
    }, gap * 1000);
    if (source === 'file') audio.pause(); else player?.pauseVideo();
    setPlaying(true);
    status(`Pusterom · ${gap} sek`);
  } else { seek(start); if (source === 'file' && audio.paused) void play(); else if (source === 'youtube') player?.playVideo(); }
}
function renderPosition(time = currentTime()) {
  $('current-time').textContent = formatTime(time, true);
  seekInput.value = String(time);
  seekInput.setAttribute('aria-valuetext', formatTime(time, true));
  $('timeline').style.setProperty('--playhead', `${clamp((time - viewStart) / (viewEnd - viewStart || 1) * 100, 0, 100)}%`);
}
function fitView(toSelection: boolean) {
  zoomed = toSelection;
  if (toSelection) {
    const margin = Math.max(0.5, (end - start) * 0.3);
    viewStart = Math.max(0, start - margin); viewEnd = Math.min(duration, end + margin);
  } else { viewStart = 0; viewEnd = duration; }
  $('zoom').innerHTML = `${icon(toSelection ? 'arrows-out-simple' : 'magnifying-glass-plus')} ${toSelection ? 'Hele låten' : 'Forstørr parti'}`;
  $('zoom').setAttribute('aria-pressed', String(toSelection));
  renderTimeline(); renderPosition();
}
function renderTimeline() {
  const timeline = $('timeline');
  const span = viewEnd - viewStart || 1;
  timeline.style.setProperty('--a', `${clamp((start - viewStart) / span * 100, 0, 100)}%`);
  timeline.style.setProperty('--b', `${clamp((end - viewStart) / span * 100, 0, 100)}%`);
  timeline.classList.toggle('loop-off', !looping);
  $('selected-length').textContent = `${(end - start).toFixed(1).replace('.', ',')} sek valgt`;
  $('duration').textContent = formatTime(duration);
  $<HTMLInputElement>('loop-start').value = formatTime(start, true);
  $<HTMLInputElement>('loop-end').value = formatTime(end, true);
  for (const [id, value] of [['start-handle', start], ['end-handle', end]] as const) {
    $(id).setAttribute('aria-valuenow', String(value));
    $(id).setAttribute('aria-valuemax', String(duration));
    $(id).setAttribute('aria-valuetext', formatTime(value, true));
  }
  seekInput.min = String(viewStart);
  seekInput.max = String(viewEnd);
  $('ruler').replaceChildren(...Array.from({ length: 5 }, (_, i) => {
    const label = document.createElement('span'); label.textContent = formatTime(viewStart + span * i / 4, span < 8); return label;
  }));
  drawWaveform();
}
function drawWaveform() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr; canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx || !width) return;
  ctx.scale(dpr, dpr);
  if (!peaks.length) {
    ctx.strokeStyle = '#3a4841'; ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 12) { ctx.beginPath(); ctx.moveTo(x, height / 2 - 5); ctx.lineTo(x, height / 2 + 5); ctx.stroke(); }
    return;
  }
  const count = Math.min(peaks.length, Math.floor(width / 4));
  const barWidth = width / count;
  for (let i = 0; i < count; i++) {
    const time = viewStart + i / count * (viewEnd - viewStart);
    const from = clamp(Math.floor(time / duration * peaks.length), 0, peaks.length - 1);
    const to = clamp(Math.ceil((viewStart + (i + 1) / count * (viewEnd - viewStart)) / duration * peaks.length), from + 1, peaks.length);
    const sample = Math.max(...peaks.slice(from, to));
    const h = Math.max(3, sample * height * 0.78);
    const inLoop = time >= start && time <= end;
    ctx.fillStyle = inLoop && looping ? '#a5c9a0' : '#59695e';
    ctx.beginPath(); ctx.roundRect(i * barWidth + 1, (height - h) / 2, Math.max(1, barWidth - 2), h, 2); ctx.fill();
  }
}
function setBoundary(which: 'start' | 'end', value: number) {
  if (!ready || !Number.isFinite(value)) return;
  const wasWaiting = gapTimer !== null;
  cancelGap();
  if (which === 'start') start = clamp(value, 0, end - MIN_LOOP);
  else end = clamp(value, start + MIN_LOOP, duration);
  activePhrase = null; resetRounds();
  if (start < viewStart || end > viewEnd) fitView(false);
  if (playing && looping && (currentTime() < start || currentTime() >= end)) { seek(start); void play(); }
  else if (wasWaiting) void play();
  renderTimeline(); renderPhrases();
}
function markBoundary(which: 'start' | 'end') {
  if (!ready) return;
  const value = clamp(currentTime(), which === 'end' ? MIN_LOOP : 0, which === 'start' ? duration - MIN_LOOP : duration);
  const length = end - start;
  if (which === 'start' && value > end - MIN_LOOP) end = Math.min(duration, value + length);
  if (which === 'end' && value < start + MIN_LOOP) start = Math.max(0, value - length);
  setBoundary(which, value);
}
function setLoop(value: boolean) {
  looping = value; loopToggle.checked = value;
  const wasWaiting = gapTimer !== null;
  cancelGap();
  if (value && playing && (currentTime() < start || currentTime() >= end)) seek(start);
  if (wasWaiting) void play();
  renderTimeline();
}
function renderSpeed() {
  $('speed-value').innerHTML = `${Math.round(speed * 100)}<span>%</span>`;
  speedInput.min = source === 'youtube' ? '0' : '25';
  speedInput.max = source === 'youtube' ? String(Math.max(0, rates.length - 1)) : '200';
  speedInput.step = source === 'youtube' ? '1' : '5';
  speedInput.value = source === 'youtube' ? String(Math.max(0, rates.indexOf(speed))) : String(speed * 100);
  speedInput.setAttribute('aria-valuetext', `${Math.round(speed * 100)} prosent`);
  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button => {
    const value = Number(button.dataset.speed);
    button.classList.toggle('selected', Math.abs(value - speed) < 0.01);
    button.setAttribute('aria-pressed', String(Math.abs(value - speed) < 0.01));
    button.disabled = !ready || (source === 'youtube' && !rates.includes(value));
  });
}
function setSpeed(value: number) {
  value = clamp(value, 0.25, 2);
  if (source === 'file') { audio.playbackRate = value; speed = audio.playbackRate; renderSpeed(); }
  else if (player && ready) {
    const nearest = rates.reduce((best, rate) => Math.abs(rate - value) < Math.abs(best - value) ? rate : best, 1);
    player.setPlaybackRate(nearest);
    // The rate-change event is authoritative; requests can be rejected by YouTube.
  }
}
function setReady(value: boolean) {
  ready = value;
  for (const id of ['play', 'restart', 'back', 'speed', 'slower', 'faster', 'save-phrase', 'mark-start', 'mark-end', 'loop-start', 'loop-end', 'seek', 'loop-enabled', 'zoom']) {
    ($(id) as HTMLButtonElement | HTMLInputElement).disabled = !value;
  }
  renderSpeed();
}
function renderPhrases() {
  $('phrase-count').textContent = String(phrases.length);
  const list = $('phrase-list'); list.replaceChildren();
  if (!phrases.length) {
    const empty = document.createElement('div'); empty.className = 'empty-phrases';
    empty.innerHTML = `${icon('bookmark-simple')}<p>Her er det plass til<br />det du vil mestre.</p><span>Velg et parti med A og B,<br />og lagre det her.</span>`; list.append(empty);
  }
  for (const phrase of phrases) {
    const row = document.createElement('div'); row.className = `phrase-row${phrase.id === activePhrase ? ' active' : ''}`;
    const button = document.createElement('button'); button.className = 'phrase-button'; button.disabled = !ready;
    const title = document.createElement('strong'); title.textContent = phrase.name;
    const meta = document.createElement('span'); meta.textContent = `${formatTime(phrase.start)} - ${formatTime(phrase.end)} · ${Math.round(phrase.speed * 100)} %`;
    const symbol = document.createElement('span'); symbol.className = 'phrase-icon'; symbol.innerHTML = icon(phrase.id === activePhrase ? 'speaker-high' : 'arrows-clockwise');
    const text = document.createElement('span'); text.append(title, meta); button.append(symbol, text);
    button.addEventListener('click', () => {
      if (phrase.start >= duration || phrase.end > duration + 0.1) { message('Dette partiet er utenfor lengden på opptaket. Velg et nytt parti.'); return; }
      pause(); start = phrase.start; end = Math.min(phrase.end, duration); activePhrase = phrase.id;
      setSpeed(phrase.speed); setLoop(true); resetRounds(); fitView(zoomed || duration > 90); seek(start); renderTimeline(); renderPhrases(); void play();
    });
    const remove = document.createElement('button'); remove.className = 'btn delete-phrase'; remove.innerHTML = icon('trash'); remove.setAttribute('aria-label', `Slett ${phrase.name}`);
    remove.addEventListener('click', () => { phrases = phrases.filter(p => p.id !== phrase.id); persistPhrases(); renderPhrases(); });
    row.append(button, remove); list.append(row);
  }
}
function resetSource(kind: 'file' | 'youtube', key: string, title: string, meta: string) {
  pause(); setReady(false); sourceVersion++;
  player?.destroy(); player = null;
  if (ytReadyTimeout) clearTimeout(ytReadyTimeout);
  audio.removeAttribute('src'); audio.load();
  if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null;
  source = kind; sourceKey = key; duration = 0; viewStart = 0; viewEnd = 0; start = 0; end = 0; speed = 1; zoomed = false;
  peaks = []; activePhrase = null; resetRounds(); message('');
  $('song-title').textContent = title; $('song-meta').textContent = meta;
  $('youtube-section').hidden = kind !== 'youtube';
  $('youtube-host').replaceChildren();
  $('timeline-label').textContent = kind === 'youtube' ? 'TIDSLINJE' : 'LYDBILDE';
  $('timeline-empty').hidden = kind !== 'youtube';
  $('source-kind').innerHTML = `${icon(kind === 'file' ? 'waveform' : 'youtube-logo')} ${kind === 'file' ? 'Lokal avspilling' : 'YouTube'}`;
  $('pitch-note').innerHTML = `${icon('music-note')} ${kind === 'file' ? 'Samme tonehøyde, ditt tempo.' : 'Hastighetene bestemmes av videoen.'}`;
  restorePhrases(); renderTimeline(); renderPosition(0); status('Åpner låten …');
  fitView(false);
  return sourceVersion;
}
function updateDuration(value: number) {
  if (!Number.isFinite(value) || value < MIN_LOOP) return;
  const first = duration === 0;
  duration = value;
  if (first) { start = 0; end = Math.min(8, duration); }
  else { end = Math.min(end, duration); start = Math.min(start, end - MIN_LOOP); }
  if (first) fitView(duration > 90);
  else if (!zoomed) viewEnd = duration;
  setReady(true); renderTimeline(); renderPhrases();
}
async function decodeWaveform(blob: Blob, version: number) {
  // ponytail: cap full-file decoding; long recordings still play with a plain timeline.
  if (blob.size > 80 * 1024 * 1024) {
    $('timeline-label').textContent = 'TIDSLINJE';
    message('Stor lydfil: avspillingen virker, men lydbildet er slått av for å spare minne.'); return;
  }
  let context: AudioContext | null = null;
  try {
    const buffer = await blob.arrayBuffer();
    if (version !== sourceVersion) return;
    context = new AudioContext();
    const decoded = await context.decodeAudioData(buffer);
    if (version !== sourceVersion) return;
    peaks = waveformPeaks(decoded.getChannelData(0)); drawWaveform();
  } catch {
    if (version === sourceVersion) { $('timeline-label').textContent = 'TIDSLINJE'; message('Lydbildet kunne ikke leses. Du kan fortsatt øve hvis nettleseren kan spille filen.'); }
  } finally { if (context) await context.close(); }
}
async function openFile(file?: File) {
  if (file && file.size === 0) { $('source-error').textContent = 'Filen er tom. Velg et lydopptak.'; $('source-error').hidden = false; return; }
  if (file && !file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|flac|opus|aiff?|webm)$/i.test(file.name)) {
    $('source-error').textContent = 'Velg en lydfil, for eksempel MP3, WAV eller M4A.'; $('source-error').hidden = false; return;
  }
  const key = file ? `${file.name}:${file.size}:${file.lastModified}` : 'demo';
  const version = resetSource('file', key, file ? file.name.replace(/\.[^.]+$/, '') : 'En liten runddans', file ? 'Lydfil · På denne enheten' : 'Innebygd demo · Syntetisk øvingsmelodi');
  $<HTMLDialogElement>('source-dialog').close();
  audio.preservesPitch = true;
  audio.volume = Number($<HTMLInputElement>('volume').value) / 100;
  audio.playbackRate = 1;
  if (file) { objectUrl = URL.createObjectURL(file); audio.src = objectUrl; void decodeWaveform(file, version); }
  else {
    audio.src = '/ovingsmelodi.wav';
    try { const response = await fetch('/ovingsmelodi.wav'); if (!response.ok) throw new Error(); const blob = await response.blob(); if (version === sourceVersion) void decodeWaveform(blob, version); }
    catch { if (version === sourceVersion) message('Øvingsmelodien kunne ikke lastes. Prøv å åpne en egen lydfil.'); }
  }
  if (version === sourceVersion) audio.load();
}
async function openYoutube(id: string) {
  const version = resetSource('youtube', `yt:${id}`, 'YouTube-opptak', 'Video · Fra YouTube');
  $<HTMLDialogElement>('source-dialog').close();
  try {
    await loadYouTube();
    if (version !== sourceVersion) return;
    const mount = document.createElement('div'); $('youtube-host').append(mount);
    ytReadyTimeout = setTimeout(() => {
      if (version === sourceVersion && !ready) { status('Videoen er ikke klar.'); message('Videoen kunne ikke gjøres klar. Prøv spill i YouTube-vinduet, en annen lenke eller en lydfil.'); }
    }, 18000);
    player = new window.YT!.Player(mount, {
      videoId: id,
      playerVars: { playsinline: 1, origin: location.origin, rel: 0, controls: 1 },
      events: {
        onReady: ({ target }) => {
          if (version !== sourceVersion) return;
          clearTimeout(ytReadyTimeout!);
          target.setVolume(Number($<HTMLInputElement>('volume').value));
          rates = target.getAvailablePlaybackRates();
          if (!rates.length) rates = [1];
          const title = target.getVideoData().title;
          if (title) $('song-title').textContent = title;
          updateDuration(target.getDuration());
          // YouTube may report duration only after playback starts. Let users start it.
          if (!ready) $<HTMLButtonElement>('play').disabled = false;
          status('Klar når du er.');
        },
        onStateChange: ({ data, target }) => {
          if (version !== sourceVersion) return;
          updateDuration(target.getDuration());
          const title = target.getVideoData().title;
          if (title) $('song-title').textContent = title;
          rates = target.getAvailablePlaybackRates(); if (!rates.length) rates = [1];
          speed = target.getPlaybackRate(); renderSpeed();
          if (data === 1) { setPlaying(true); message(''); }
          if (data === 2 && gapTimer === null) setPlaying(false);
          if (data === 0) { if (looping && ready) loopBack(); else { setPlaying(false); status('Ferdig. Ta en runde til?'); } }
          if (data === 3) status('Videoen laster …');
        },
        onPlaybackRateChange: ({ target }) => { if (version === sourceVersion) { speed = target.getPlaybackRate(); renderSpeed(); } },
        onAutoplayBlocked: () => { if (version === sourceVersion) { setPlaying(false); message('Trykk på spill i YouTube-vinduet for å starte videoen.'); } },
        onError: ({ data }) => {
          if (version !== sourceVersion) return;
          clearTimeout(ytReadyTimeout!); pause(); setReady(false); status('Videoen kunne ikke spilles.');
          const reason = [101, 150].includes(data) ? 'Eieren tillater ikke at videoen spilles her.' : data === 100 ? 'Videoen er slettet, privat eller utilgjengelig.' : data === 153 ? 'YouTube kunne ikke godkjenne denne avspilleren.' : 'YouTube kunne ikke spille denne videoen.';
          message(`${reason} Prøv en annen YouTube-lenke eller en lydfil.`);
        },
      },
    });
  } catch (error) { if (version === sourceVersion) { status('YouTube kunne ikke åpnes.'); message(error instanceof Error ? error.message : 'Prøv en annen lenke.'); } }
}

audio.addEventListener('loadedmetadata', () => {
  if (source !== 'file') return;
  if (!Number.isFinite(audio.duration) || audio.duration < MIN_LOOP) { message('Opptaket må ha en kjent lengde på minst et kvart sekund.'); return; }
  updateDuration(audio.duration); status('Klar når du er.');
});
audio.addEventListener('play', () => { if (source === 'file') setPlaying(true); });
audio.addEventListener('pause', () => { if (source === 'file' && gapTimer === null) setPlaying(false); });
audio.addEventListener('ended', () => { if (source === 'file') { if (looping) loopBack(); else { setPlaying(false); status('Ferdig. Ta en runde til?'); } } });
audio.addEventListener('error', () => { if (source === 'file' && audio.hasAttribute('src')) { pause(); setReady(false); status('Filen kunne ikke spilles.'); message('Nettleseren kunne ikke spille denne lydfilen. Prøv en annen fil eller et annet lydformat.'); } });

$('play').addEventListener('click', () => { if (source === 'youtube' && !ready && player) player.playVideo(); else togglePlay(); });
$('zoom').addEventListener('click', () => fitView(!zoomed));
$('restart').addEventListener('click', () => { const waiting = gapTimer !== null; cancelGap(); seek(looping ? start : 0); if (waiting) void play(); });
$('back').addEventListener('click', () => seek(Math.max(looping ? start : 0, currentTime() - 2)));
seekInput.addEventListener('input', () => { const waiting = gapTimer !== null; cancelGap(); seek(Number(seekInput.value)); if (waiting) void play(); });
$<HTMLInputElement>('volume').addEventListener('input', event => {
  const value = Number((event.target as HTMLInputElement).value);
  audio.volume = value / 100; if (source === 'youtube') player?.setVolume?.(value);
});
speedInput.addEventListener('input', () => setSpeed(source === 'youtube' ? rates[Number(speedInput.value)] : Number(speedInput.value) / 100));
document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button => button.addEventListener('click', () => setSpeed(Number(button.dataset.speed))));
for (const [id, direction] of [['slower', -1], ['faster', 1]] as const) {
  $(id).addEventListener('click', () => setSpeed(source === 'file' ? speed + direction * 0.05 : rates[clamp(rates.indexOf(speed) + direction, 0, rates.length - 1)]));
}
loopToggle.addEventListener('change', () => setLoop(loopToggle.checked));
$<HTMLSelectElement>('gap').addEventListener('change', event => { gap = Number((event.target as HTMLSelectElement).value); if (gapTimer !== null) { cancelGap(); seek(start); void play(); } });
$('mark-start').addEventListener('click', () => markBoundary('start'));
$('mark-end').addEventListener('click', () => markBoundary('end'));
for (const which of ['start', 'end'] as const) {
  const input = $<HTMLInputElement>(`loop-${which}`);
  input.addEventListener('change', () => {
    const value = parseTime(input.value);
    if (value === null || value < 0 || value > duration || (which === 'start' ? value > end - MIN_LOOP : value < start + MIN_LOOP)) {
      message('Bruk minutter:sekunder, for eksempel 0:12.5. Slutten må være minst 0,25 sekunder etter starten.'); renderTimeline();
    } else { message(''); setBoundary(which, value); }
  });
  const handle = $(`${which}-handle`);
  handle.addEventListener('pointerdown', event => {
    if (!ready) return;
    event.preventDefault(); handle.focus(); handle.setPointerCapture(event.pointerId);
    const bounds = $('timeline').getBoundingClientRect();
    const viewFrom = viewStart; const viewSpan = viewEnd - viewStart;
    const move = (moveEvent: PointerEvent) => setBoundary(which, viewFrom + clamp((moveEvent.clientX - bounds.left) / bounds.width, 0, 1) * viewSpan);
    const stop = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
  });
  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const value = which === 'start' ? start : end;
    setBoundary(which, event.key === 'Home' ? 0 : event.key === 'End' ? duration : value + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 0.1));
  });
}
function openSource() { $('source-error').hidden = true; $<HTMLDialogElement>('source-dialog').showModal(); }
$('source-open').addEventListener('click', openSource);
$('help-open').addEventListener('click', () => $<HTMLDialogElement>('help-dialog').showModal());
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button => button.addEventListener('click', () => $<HTMLDialogElement>(button.dataset.close!).close()));
$('youtube-form').addEventListener('submit', event => {
  event.preventDefault();
  const id = youtubeId($<HTMLInputElement>('youtube-url').value);
  if (!id) { $('source-error').textContent = 'Bruk en lenke til en YouTube-video. Spotify og spillelister støttes ikke her.'; $('source-error').hidden = false; return; }
  void openYoutube(id);
});
$<HTMLInputElement>('audio-file').addEventListener('change', event => {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (file) void openFile(file); input.value = '';
});
$('file-drop').addEventListener('dragover', event => { event.preventDefault(); $('file-drop').classList.add('dragging'); });
$('file-drop').addEventListener('dragleave', () => $('file-drop').classList.remove('dragging'));
$('file-drop').addEventListener('drop', event => { event.preventDefault(); $('file-drop').classList.remove('dragging'); const file = event.dataTransfer?.files[0]; if (file) void openFile(file); });
$('load-demo').addEventListener('click', () => void openFile());
$('save-phrase').addEventListener('click', () => {
  if (!ready) return;
  if (phrases.length >= 100) { message('Du har 100 øvepartier for denne låten. Slett et parti før du lagrer flere.'); return; }
  $<HTMLInputElement>('phrase-name').value = '';
  $('save-description').textContent = `${formatTime(start, true)} til ${formatTime(end, true)}, i ${Math.round(speed * 100)} % tempo.`;
  $<HTMLDialogElement>('save-dialog').showModal(); $<HTMLInputElement>('phrase-name').focus();
});
$('save-form').addEventListener('submit', event => {
  event.preventDefault(); const name = $<HTMLInputElement>('phrase-name').value.trim(); if (!name) return;
  const phrase = { id: crypto.randomUUID(), name, start, end, speed };
  phrases.push(phrase); activePhrase = phrase.id; persistPhrases(); renderPhrases(); $<HTMLDialogElement>('save-dialog').close();
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return;
  const target = event.target as HTMLElement;
  if (target.closest('input:not([type="range"]):not([type="checkbox"]), select, textarea, [contenteditable]:not([contenteditable="false"])')) return;
  if (!ready) return;
  if (event.code === 'Space') {
    if (target.matches('input[type="checkbox"]')) return;
    event.preventDefault(); if (!event.repeat) togglePlay();
  }
  else if (event.key.toLowerCase() === 'a' && !event.repeat) markBoundary('start');
  else if (event.key.toLowerCase() === 'b' && !event.repeat) markBoundary('end');
  else if (event.key.toLowerCase() === 'l' && !event.repeat) setLoop(!looping);
  else if (['ArrowLeft', 'ArrowRight'].includes(event.key) && !target.closest('input, [role="slider"]')) { event.preventDefault(); seek(currentTime() + (event.key === 'ArrowLeft' ? -2 : 2)); }
});
setInterval(() => {
  if (!ready) return;
  if (gapTimer !== null) { status(`Pusterom · ${Math.max(1, Math.ceil((gapUntil - performance.now()) / 1000))} sek`); return; }
  const time = currentTime();
  if (playing && !looping && zoomed && (time > viewEnd || time < viewStart)) fitView(false);
  renderPosition(time);
  if (playing) {
    if (looping && performance.now() > seekLockUntil && (time >= end - 0.025 || time < start - 0.1)) loopBack();
    else status(looping ? 'Spiller øvepartiet om igjen.' : 'Spiller hele låten.');
  }
}, 30);
new ResizeObserver(drawWaveform).observe($('timeline'));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ready && playing && looping && gapTimer === null && currentTime() >= end) loopBack();
});
void openFile();
