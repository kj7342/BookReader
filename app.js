// Listen — Text Reader PWA
// Uses the Web Speech API for on-device TTS (no server).
// Tip: Different devices expose different voices. iOS exposes limited voices but supports rate & pitch.

const $ = sel => document.querySelector(sel);
const textInput = $('#textInput');
const voiceSelect = $('#voiceSelect');
const rate = $('#rate');
const pitch = $('#pitch');
const rateVal = $('#rateVal');
const pitchVal = $('#pitchVal');
const playBtn = $('#playBtn');
const pauseBtn = $('#pauseBtn');
const resumeBtn = $('#resumeBtn');
const stopBtn = $('#stopBtn');
const fileInput = $('#fileInput');
const clearBtn = $('#clearBtn');
const progress = $('#progress');
const progressLabel = $('#progressLabel');
const chunkSizeInput = $('#chunkSize');
const chunkVal = $('#chunkVal');
const saveBtn = $('#saveBtn');
const installBtn = $('#installBtn');

let voices = [];
let aiVoices = [];
let chunks = [];
let currentIndex = 0;
let speaking = false;
let pendingUtterance = null;
let deferredPrompt = null;

function log(...args){ console.log('[Listen]', ...args); }

// Manifest-driven PWA install prompt (Android/desktop). iOS uses Add to Home Screen.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  log('Install choice:', outcome);
  installBtn.hidden = true;
});

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => log('SW error', err));
  });
}

// Load voices (some browsers need async event)
function populateVoices() {
  voices = speechSynthesis.getVoices().sort((a,b)=> a.name.localeCompare(b.name));
  voiceSelect.innerHTML = '';
  for (const v of voices) {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} ${v.lang.includes('en') ? '' : '('+v.lang+')'}`.trim();
    opt.dataset.lang = v.lang;
    voiceSelect.appendChild(opt);
  }
  // Try to default to an English voice
  const preferred = voices.find(v => v.lang.startsWith('en')) || voices[0];
  if (preferred) voiceSelect.value = preferred.voiceURI;
}
async function fetchAIVoices() {
  try {
    const res = await fetch('ai-voices.json');
    if (!res.ok) throw new Error(res.statusText);
    aiVoices = await res.json();
    for (const v of aiVoices) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `AI: ${v.name} ${v.lang ? '('+v.lang+')' : ''}`.trim();
      opt.dataset.lang = v.lang || '';
      opt.dataset.provider = 'ai';
      voiceSelect.appendChild(opt);
    }
  } catch (e) {
    log('AI voice fetch error', e);
  }
}
populateVoices();
fetchAIVoices();
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = () => { populateVoices(); fetchAIVoices(); };
}

// State restore
(function restore(){
  const saved = localStorage.getItem('listen_state');
  if (!saved) return;
  try {
    const s = JSON.parse(saved);
    textInput.value = s.text || '';
    currentIndex = s.index || 0;
    rate.value = s.rate || 1;
    pitch.value = s.pitch || 1;
    chunkSizeInput.value = s.chunkSize || 220;
    rateVal.textContent = rate.value;
    pitchVal.textContent = pitch.value;
    chunkVal.textContent = chunkSizeInput.value;
    if (textInput.value) {
      chunks = chunkText(textInput.value, Number(chunkSizeInput.value));
      updateProgress();
    }
  } catch(e){ log('restore error', e); }
})();

// Save state
function saveState(){
  const state = {
    text: textInput.value,
    index: currentIndex,
    rate: Number(rate.value),
    pitch: Number(pitch.value),
    chunkSize: Number(chunkSizeInput.value),
  };
  localStorage.setItem('listen_state', JSON.stringify(state));
}

// Chunking logic: split by paragraphs, then sentences, then cap by size.
function chunkText(text, maxLen) {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const parts = [];
  for (const p of paras) {
    // Split by sentence-ish boundaries
    const sents = p.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (let s of sents) {
      s = s.trim();
      if (s.length <= maxLen) {
        parts.push(s);
      } else {
        // further hard wrap
        let i = 0;
        while (i < s.length) {
          let slice = s.slice(i, i + maxLen);
          // try backtrack to last space
          const lastSpace = slice.lastIndexOf(' ');
          if (lastSpace > maxLen * 0.6) slice = slice.slice(0, lastSpace);
          parts.push(slice.trim());
          i += slice.length;
        }
      }
    }
    parts.push(''); // paragraph break pause
  }
  return parts;
}

// Build utterance for a given chunk
function makeUtterance(text) {
  const u = new SpeechSynthesisUtterance(text || ' ');
  const v = voices.find(v => v.voiceURI === voiceSelect.value);
  if (v) u.voice = v;
  u.rate = Number(rate.value);
  u.pitch = Number(pitch.value);
  u.onend = () => {
    pendingUtterance = null;
    if (!speaking) return;
    currentIndex++;
    updateProgress();
    if (currentIndex < chunks.length) {
      queueNext();
    } else {
      speaking = false;
      updateProgress();
    }
  };
  u.onerror = (e) => {
    log('utterance error', e);
    pendingUtterance = null;
    speaking = false;
  };
  return u;
}

function updateProgress() {
  const pct = chunks.length ? Math.min(100, Math.floor((currentIndex / chunks.length) * 100)) : 0;
  progress.value = pct;
  progressLabel.textContent = pct + '%';
}

async function speakWithAIVoice(text, voiceId) {
  try {
    const res = await fetch('https://api.example.com/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceId })
    });
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    pendingUtterance = audio;
    audio.onended = () => {
      pendingUtterance = null;
      if (!speaking) return;
      currentIndex++;
      updateProgress();
      if (currentIndex < chunks.length) {
        queueNext();
      } else {
        speaking = false;
        updateProgress();
      }
    };
    audio.onerror = (e) => {
      log('ai audio error', e);
      pendingUtterance = null;
      speaking = false;
    };
    await audio.play();
  } catch (e) {
    log('AI TTS error', e);
    speaking = false;
  }
}

// Control handlers
playBtn.addEventListener('click', () => {
  if (!textInput.value.trim()) return;
  chunks = chunkText(textInput.value, Number(chunkSizeInput.value));
  if (!speaking) {
    // If resuming from middle, continue; else start from beginning
    if (currentIndex >= chunks.length) currentIndex = 0;
    speaking = true;
    queueNext(true);
  }
});

pauseBtn.addEventListener('click', () => {
  if (pendingUtterance instanceof HTMLAudioElement) {
    pendingUtterance.pause();
    speaking = false;
  } else if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
    speaking = false;
  }
});

resumeBtn.addEventListener('click', () => {
  if (pendingUtterance instanceof HTMLAudioElement) {
    pendingUtterance.play();
    speaking = true;
  } else if (speechSynthesis.paused) {
    speechSynthesis.resume();
    speaking = true;
  } else if (!speechSynthesis.speaking) {
    // start fresh if nothing currently speaking
    playBtn.click();
  }
});

stopBtn.addEventListener('click', () => {
  if (pendingUtterance instanceof HTMLAudioElement) {
    pendingUtterance.pause();
    pendingUtterance.currentTime = 0;
  } else {
    speechSynthesis.cancel();
  }
  speaking = false;
  pendingUtterance = null;
});

saveBtn.addEventListener('click', () => {
  saveState();
  saveBtn.textContent = 'Saved ✔︎';
  setTimeout(()=> saveBtn.textContent='💾 Save Progress', 1200);
});

rate.addEventListener('input', () => { rateVal.textContent = rate.value; });
pitch.addEventListener('input', () => { pitchVal.textContent = pitch.value; });
chunkSizeInput.addEventListener('input', () => { chunkVal.textContent = chunkSizeInput.value; });

clearBtn.addEventListener('click', () => {
  textInput.value = '';
  chunks = [];
  currentIndex = 0;
  updateProgress();
  saveState();
});

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  textInput.value = text;
  currentIndex = 0;
  chunks = chunkText(text, Number(chunkSizeInput.value));
  updateProgress();
  saveState();
  // Reset input to allow re-loading the same file later
  fileInput.value = '';
});

// Queue the next utterance (and optional initial "unlock" speech on iOS)
function queueNext(unlock=false) {
  if (unlock && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    // iOS sometimes needs a fresh utterance to unlock audio. We just proceed normally.
  }
  const text = chunks[currentIndex] ?? '';
  const selected = voiceSelect.options[voiceSelect.selectedIndex];
  if (selected?.dataset.provider === 'ai') {
    speakWithAIVoice(text, selected.value);
  } else {
    pendingUtterance = makeUtterance(text);
    speechSynthesis.speak(pendingUtterance);
  }
  updateProgress();
}

// Persist index as user listens (best effort)
window.addEventListener('visibilitychange', () => {
  if (document.hidden) saveState();
});
window.addEventListener('beforeunload', saveState);
