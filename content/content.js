const api = typeof browser !== 'undefined' ? browser : chrome;

let cues = [];
let settings = {
  mode: 'fixed',
  fixedMs: 2000,
  msPerWord: 400,
  msPerChar: 60,
  minPause: 500,
  minChars: 2,
  preRollMs: 0,
  offsetSec: 0,
  active: false,
};
let video = null;
let cueIndex = 0;
let state = 'IDLE'; // IDLE | PAUSED
let resumeTimer = null;
let intervalId = null;

// — Subtitle overlay —

const overlay = document.createElement('div');
overlay.style.cssText = `
  position: fixed;
  pointer-events: none;
  z-index: 2147483647;
  display: none;
  align-items: flex-end;
  justify-content: center;
  padding: 0 4% 3%;
  box-sizing: border-box;
`;
const overlayText = document.createElement('div');
overlayText.style.cssText = `
  color: #fff;
  font-family: Arial, sans-serif;
  font-size: clamp(16px, 2.8vmin, 36px);
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
  max-width: 80%;
  text-shadow: 0 0 4px #000, 0 0 10px #000;
  background: rgba(0,0,0,0.45);
  padding: 5px 14px 6px;
  border-radius: 4px;
`;
overlay.appendChild(overlayText);
(document.body || document.documentElement).appendChild(overlay);

// On file:// pages the body may not exist yet at injection time — retry once it does
if (!document.body) {
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
}

function positionOverlay() {
  if (!video) return;
  const r = video.getBoundingClientRect();
  const left   = r.width  > 0 ? r.left   : 0;
  const top    = r.height > 0 ? r.top    : 0;
  const width  = r.width  > 0 ? r.width  : window.innerWidth;
  const height = r.height > 0 ? r.height : window.innerHeight;
  overlay.style.left   = left   + 'px';
  overlay.style.top    = top    + 'px';
  overlay.style.width  = width  + 'px';
  overlay.style.height = height + 'px';
}

function showSubtitle(text) {
  positionOverlay();
  overlayText.textContent = text;
  overlay.style.display = 'flex';
}

function hideSubtitle() {
  overlay.style.display = 'none';
}

// Reposition if the video moves (resize, scroll, fullscreen)
window.addEventListener('resize', positionOverlay);
window.addEventListener('scroll', positionOverlay, true);
document.addEventListener('fullscreenchange', positionOverlay);

// — Video detection —

function findVideo() {
  return document.querySelector('video');
}

function attachVideo(v) {
  if (video === v) return;
  video = v;
  video.addEventListener('seeked', onSeeked);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(positionOverlay).observe(v);
  }
}

function onSeeked() {
  clearTimeout(resumeTimer);
  resumeTimer = null;
  hideSubtitle();
  state = 'IDLE';
  cueIndex = findCueIndexForTime(video.currentTime);
}

function findCueIndexForTime(t) {
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start >= t) return i;
  }
  return cues.length;
}

// — Timing loop —

function visibleCharCount(text) {
  if (!text) return 0;
  const stripped = text
    .replace(/\(.*?\)/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\s+/g, '');
  return [...stripped].length;
}

function pauseDurationFor(cue) {
  if (settings.mode === 'fixed') return settings.fixedMs;
  if (settings.mode === 'char') {
    const chars = visibleCharCount(cue.text);
    return Math.max(settings.minPause, chars * (settings.msPerChar || 60));
  }
  const words = cue.text.trim().split(/\s+/).length;
  return Math.max(settings.minPause, words * settings.msPerWord);
}

function tick() {
  if (!settings.active || !video || state !== 'IDLE') return;
  if (cueIndex >= cues.length) return;
  if (video.paused && state === 'IDLE') return; // user manually paused

  const cue = cues[cueIndex];
  const preRoll = (settings.preRollMs ?? 0) / 1000;
  const triggerAt = cue.start + (settings.offsetSec || 0) - preRoll;

  if (video.currentTime >= triggerAt) {
    if (visibleCharCount(cue.text) < (settings.minChars || 0)) {
      cueIndex++;
      return;
    }
    state = 'PAUSED';
    video.pause();
    showSubtitle(cue.text);

    const duration = pauseDurationFor(cue);
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      if (state !== 'PAUSED') return;
      hideSubtitle();
      state = 'IDLE';
      cueIndex++;
      video.play().catch(() => {});
    }, duration);
  }
}

function startLoop() {
  if (intervalId) return;
  intervalId = setInterval(tick, 100);
}

function stopLoop() {
  clearInterval(intervalId);
  intervalId = null;
  clearTimeout(resumeTimer);
  resumeTimer = null;
  hideSubtitle();
  state = 'IDLE';
}

// — YouTube SPA: watch for video element appearing —

const observer = new MutationObserver(() => {
  const v = findVideo();
  if (v && v !== video) attachVideo(v);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

const initialVideo = findVideo();
if (initialVideo) attachVideo(initialVideo);

// — Load persisted state on startup —

api.storage.local.get(['cues', 'settings'], result => {
  if (result.cues) {
    cues = result.cues;
    cueIndex = 0;
  }
  if (result.settings) {
    settings = { ...settings, ...result.settings };
    if (settings.active) startLoop();
  }
});

// — Message listener —

api.runtime.onMessage.addListener((msg) => {
  switch (msg.type) {
    case 'LOAD_CUES':
      cues = msg.cues || [];
      settings = msg.settings || settings;
      cueIndex = video ? findCueIndexForTime(video.currentTime) : 0;
      state = 'IDLE';
      clearTimeout(resumeTimer);
      resumeTimer = null;
      hideSubtitle();
      if (settings.active) startLoop();
      break;

    case 'UPDATE_SETTINGS':
      settings = msg.settings;
      if (settings.active) {
        startLoop();
      } else {
        stopLoop();
      }
      break;

    case 'SET_ACTIVE':
      settings.active = msg.active;
      if (msg.active) startLoop(); else stopLoop();
      break;

    case 'CLEAR_CUES':
      cues = [];
      cueIndex = 0;
      state = 'IDLE';
      clearTimeout(resumeTimer);
      resumeTimer = null;
      hideSubtitle();
      if (video && video.paused) video.play().catch(() => {});
      break;
  }
});
