const api = typeof browser !== 'undefined' ? browser : chrome;

const els = {
  dropZone:     document.getElementById('dropZone'),
  srtFile:      document.getElementById('srtFile'),
  cueStatus:    document.getElementById('cueStatus'),
  clearCues:    document.getElementById('clearCues'),
  activeToggle: document.getElementById('activeToggle'),
  modeToggle:   document.getElementById('modeToggle'),
  fixedSettings:   document.getElementById('fixedSettings'),
  dynamicSettings: document.getElementById('dynamicSettings'),
  charSettings:    document.getElementById('charSettings'),
  minPauseRow:  document.getElementById('minPauseRow'),
  fixedMs:      document.getElementById('fixedMs'),
  msPerWord:    document.getElementById('msPerWord'),
  msPerWordVal: document.getElementById('msPerWordVal'),
  msPerChar:    document.getElementById('msPerChar'),
  msPerCharVal: document.getElementById('msPerCharVal'),
  minPause:     document.getElementById('minPause'),
  minChars:     document.getElementById('minChars'),
  preRollMs:    document.getElementById('preRollMs'),
  offsetSec:    document.getElementById('offsetSec'),
  offsetDown:   document.getElementById('offsetDown'),
  offsetUp:     document.getElementById('offsetUp'),
  tabStatus:    document.getElementById('tabStatus'),
  fileNote:     document.getElementById('fileNote'),
};

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

function buildSettings() {
  return {
    mode:      settings.mode,
    fixedMs:   parseInt(els.fixedMs.value) || 2000,
    msPerWord: parseInt(els.msPerWord.value) || 400,
    msPerChar: parseInt(els.msPerChar.value) || 60,
    minPause:  parseInt(els.minPause.value) || 500,
    minChars:  parseInt(els.minChars.value) || 0,
    preRollMs: parseInt(els.preRollMs.value) || 0,
    offsetSec: parseFloat(els.offsetSec.value) || 0,
    active:    els.activeToggle.checked,
  };
}

function applySettingsToUI(s) {
  els.activeToggle.checked     = s.active;
  els.fixedMs.value            = s.fixedMs;
  els.msPerWord.value          = s.msPerWord;
  els.msPerWordVal.textContent = s.msPerWord;
  els.msPerChar.value          = s.msPerChar ?? 60;
  els.msPerCharVal.textContent = s.msPerChar ?? 60;
  els.minPause.value           = s.minPause;
  els.minChars.value           = s.minChars ?? 2;
  els.preRollMs.value          = s.preRollMs;
  els.offsetSec.value          = s.offsetSec ?? 0;
  setMode(s.mode, false);
}

function setMode(mode, save = true) {
  settings.mode = mode;
  els.modeToggle.querySelectorAll('.seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  els.fixedSettings.style.display   = mode === 'fixed'   ? '' : 'none';
  els.dynamicSettings.style.display = mode === 'dynamic' ? '' : 'none';
  els.charSettings.style.display    = mode === 'char'    ? '' : 'none';
  els.minPauseRow.style.display     = mode === 'fixed'   ? 'none' : '';
  if (save) saveAndSync();
}

function saveAndSync() {
  const s = buildSettings();
  Object.assign(settings, s);
  api.storage.local.set({ settings: s });
  sendToContentScript({ type: 'UPDATE_SETTINGS', settings: s });
}

function sendToContentScript(msg) {
  api.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    api.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
  });
}

function loadCues(file) {
  const reader = new FileReader();
  reader.onload = e => {
    cues = parseSRT(e.target.result);
    if (cues.length === 0) {
      els.cueStatus.textContent = 'No cues found — check file format.';
      return;
    }
    setCueStatus(cues.length);
    const s = buildSettings();
    api.storage.local.set({ cues });
    sendToContentScript({ type: 'LOAD_CUES', cues, settings: s });
  };
  reader.readAsText(file);
}

function setCueStatus(count) {
  if (count > 0) {
    els.cueStatus.textContent = `${count} cues loaded`;
    els.clearCues.style.display = '';
  } else {
    els.cueStatus.textContent = 'No file loaded';
    els.clearCues.style.display = 'none';
  }
}

function clearCues() {
  cues = [];
  els.srtFile.value = '';
  setCueStatus(0);
  api.storage.local.remove('cues');
  sendToContentScript({ type: 'CLEAR_CUES' });
}

function updateTabStatus() {
  api.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return;
    const url = tabs[0].url || '';
    if (url.startsWith('file://')) {
      els.tabStatus.textContent = 'Local file detected.';
      els.fileNote.style.display = '';
    } else if (url.includes('youtube.com')) {
      els.tabStatus.textContent = 'YouTube detected.';
      els.fileNote.style.display = 'none';
    } else {
      els.tabStatus.textContent = 'Navigate to YouTube or a local video file.';
      els.fileNote.style.display = 'none';
    }
  });
}

function stepOffset(delta) {
  const current = parseFloat(els.offsetSec.value) || 0;
  els.offsetSec.value = Math.round((current + delta) * 10) / 10;
  saveAndSync();
}

// — Init —

api.storage.local.get(['settings', 'cues'], result => {
  if (result.settings) {
    Object.assign(settings, result.settings);
    applySettingsToUI(settings);
  }
  if (result.cues && result.cues.length > 0) {
    cues = result.cues;
    setCueStatus(cues.length);
  }
});

updateTabStatus();

// — Event listeners —

els.dropZone.addEventListener('click', () => els.srtFile.click());
els.srtFile.addEventListener('change', e => { if (e.target.files[0]) loadCues(e.target.files[0]); });
els.clearCues.addEventListener('click', e => { e.stopPropagation(); clearCues(); });

els.dropZone.addEventListener('dragover', e => { e.preventDefault(); els.dropZone.classList.add('drag-over'); });
els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag-over'));
els.dropZone.addEventListener('drop', e => {
  e.preventDefault();
  els.dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.srt')) loadCues(file);
});

els.modeToggle.addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (btn) setMode(btn.dataset.mode);
});

els.activeToggle.addEventListener('change', saveAndSync);
els.fixedMs.addEventListener('change', saveAndSync);
els.minPause.addEventListener('change', saveAndSync);
els.minChars.addEventListener('change', saveAndSync);
els.preRollMs.addEventListener('change', saveAndSync);
els.offsetSec.addEventListener('change', saveAndSync);
els.offsetDown.addEventListener('click', () => stepOffset(-0.1));
els.offsetUp.addEventListener('click',   () => stepOffset(+0.1));
els.msPerWord.addEventListener('input', () => {
  els.msPerWordVal.textContent = els.msPerWord.value;
  saveAndSync();
});
els.msPerChar.addEventListener('input', () => {
  els.msPerCharVal.textContent = els.msPerChar.value;
  saveAndSync();
});
