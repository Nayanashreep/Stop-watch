// ====== Elements ======
const timeEl = document.getElementById('time');
const startPauseBtn = document.getElementById('startPause');
const lapBtn = document.getElementById('lap');
const resetBtn = document.getElementById('reset');
const clearLapsBtn = document.getElementById('clearLaps');
const lapsBody = document.getElementById('lapsBody');

// ====== State ======
// Use high-resolution clock and RAF for smooth/accurate timing
let rafId = null;
let startTime = 0;       // performance.now() when (last) started
let elapsed = 0;         // total elapsed ms when paused
let running = false;     // is ticking?
let laps = [];           // cumulative lap times in ms

// ====== Persistence ======
const STORAGE_KEY = 'interactiveStopwatch_v1';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    startTime,
    elapsed,
    running,
    laps
  }));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    startTime = s.startTime || 0;
    elapsed = s.elapsed || 0;
    running = !!s.running;
    laps = Array.isArray(s.laps) ? s.laps : [];
  } catch { /* ignore */ }
}

// ====== Utils ======
const pad2 = n => (n < 10 ? '0' + n : '' + n);
function formatMs(ms) {
  const totalMs = Math.max(0, Math.floor(ms));
  const centi = Math.floor((totalMs % 1000) / 10); // hundredths
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad2(centi)}`;
}
const now = () => performance.now();

function currentElapsed() {
  return running ? (elapsed + (now() - startTime)) : elapsed;
}

function setTitle(ms) {
  document.title = running ? `${formatMs(ms)} • Stopwatch` : `Stopwatch`;
}

// ====== Render ======
function renderTime() {
  const ms = currentElapsed();
  timeEl.textContent = formatMs(ms);
  setTitle(ms);
}

function bestWorstIndices(list) {
  if (list.length < 2) return { best: -1, worst: -1 }; // need at least 2 laps to compare splits
  const splits = list.map((cum, i) => i === 0 ? cum : (cum - list[i-1]));
  let best = 0, worst = 0;
  splits.forEach((v, i) => {
    if (v < splits[best]) best = i;
    if (v > splits[worst]) worst = i;
  });
  return { best, worst };
}

function renderLaps() {
  lapsBody.innerHTML = '';
  if (!laps.length) return;

  const { best, worst } = bestWorstIndices(laps);

  laps.forEach((cum, i) => {
    const tr = document.createElement('tr');

    // # column
    const tdNum = document.createElement('td');
    tdNum.textContent = i + 1;

    // Total column (cumulative)
    const tdTotal = document.createElement('td');
    tdTotal.textContent = formatMs(cum);

    // Split column (difference from previous)
    const tdSplit = document.createElement('td');
    const split = i === 0 ? cum : (cum - laps[i-1]);
    tdSplit.textContent = formatMs(split);

    // badges for best / worst split
    if (i === best && laps.length > 1) {
      const b = document.createElement('span');
      b.className = 'badge best';
      b.textContent = 'Best';
      tdSplit.appendChild(b);
    }
    if (i === worst && laps.length > 1) {
      const b = document.createElement('span');
      b.className = 'badge worst';
      b.textContent = 'Worst';
      tdSplit.appendChild(b);
    }

    tr.appendChild(tdNum);
    tr.appendChild(tdTotal);
    tr.appendChild(tdSplit);
    lapsBody.appendChild(tr);
  });
}

function updateButtons() {
  lapBtn.disabled = !running;
  resetBtn.disabled = currentElapsed() <= 0 && laps.length === 0;
  clearLapsBtn.disabled = laps.length === 0;
  startPauseBtn.setAttribute('aria-pressed', String(running));
  startPauseBtn.textContent = running ? 'Pause' : (elapsed > 0 ? 'Resume' : 'Start');
}

// ====== Engine (RAF loop) ======
function tick() {
  renderTime();
  rafId = requestAnimationFrame(tick);
}

// ====== Actions ======
function start() {
  if (running) return;
  startTime = now();
  running = true;
  updateButtons();
  saveState();
  tick();
}

function pause() {
  if (!running) return;
  // accumulate elapsed
  elapsed += (now() - startTime);
  running = false;
  cancelAnimationFrame(rafId);
  rafId = null;
  renderTime();
  updateButtons();
  saveState();
}

function reset() {
  // stop
  if (running) pause();
  elapsed = 0;
  startTime = 0;
  renderTime();
  updateButtons();
  saveState();
}

function lap() {
  if (!running) return;
  const cum = currentElapsed();
  laps.push(cum);
  renderLaps();
  updateButtons();
  saveState();
}

function clearLaps() {
  laps = [];
  renderLaps();
  updateButtons();
  saveState();
}

// ====== Wire up ======
startPauseBtn.addEventListener('click', () => (running ? pause() : start()));
lapBtn.addEventListener('click', lap);
resetBtn.addEventListener('click', reset);
clearLapsBtn.addEventListener('click', clearLaps);

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  // Ignore when typing in inputs (none here, but safe)
  const tag = (e.target && e.target.tagName) || '';
  if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;

  if (e.code === 'Space') {
    e.preventDefault();
    running ? pause() : start();
  } else if (e.key.toLowerCase() === 'l') {
    e.preventDefault();
    lap();
  } else if (e.key.toLowerCase() === 'r') {
    e.preventDefault();
    reset();
  }
});

// ====== Init ======
loadState();

// If state said we were running, resume with correct start offset
if (running) {
  // Adjust startTime so elapsed continues correctly
  const drift = now() - (startTime || now());
  startTime = now() - drift; // keep continuity
  tick();
} else {
  renderTime();
}

renderLaps();
updateButtons();

// Save before unload to persist last timing precisely
window.addEventListener('beforeunload', saveState);
