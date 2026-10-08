const $ = (s) => document.querySelector(s);
const CIRC = 339.292;                                   // ring length = 2 · π · 54
const MODES = {                                         // s = seconds, n = plants earned
  focus: { s: 1500, n: 1 }, deep: { s: 3000, n: 2 },
  break: { s: 300, n: 0 },  demo: { s: 10, n: 1 }
};
const SMALL = ['🌱', '🌿', '🌷', '🌻', '🌼'];
const BIG = ['🌳', '🌲', '🌴', '🌸'];
const RANKS = [[0, 'Seed'], [1, 'Sprout'], [5, 'Gardener'], [15, 'Botanist'], [30, 'Forest Keeper']];
const QUOTES = [
  'Small steps every day grow into a forest.',
  'Focus on the next 25 minutes, nothing else.',
  'Consistency beats intensity.',
  'Your future self is watching. Make them proud.',
  'Done is better than perfect.',
  'Every expert was once a beginner.',
  'Plant the seed today, enjoy the shade later.'
];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dayKey = (d = new Date()) => d.toLocaleDateString('en-CA');   // YYYY-MM-DD

/* ---------- State saved in the browser ---------- */
const DEFAULTS = { tasks: [], plants: [], sessions: 0, minutes: 0, streak: 0, lastDay: '',
                   todayDay: '', today: 0, tasksDone: 0, theme: 'light', goal: 4 };
function load() {
  try { return { ...DEFAULTS, tasks: [], plants: [], ...JSON.parse(localStorage.getItem('focusgarden-pro')) }; }
  catch { return { ...DEFAULTS, tasks: [], plants: [] }; }
}
const state = load();
const save = () => { try { localStorage.setItem('focusgarden-pro', JSON.stringify(state)); } catch {} };
function rollDay() {                                    // new day -> reset today's counter
  const t = dayKey();
  if (state.todayDay !== t) { state.todayDay = t; state.today = 0; }
}

/* ---------- Small helpers ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}
function beep() {                                       // short sound, no audio file needed
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    const o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 660;
    g.gain.setValueAtTime(0.2, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.8);
    o.start(); o.stop(a.currentTime + 0.8);
  } catch {}
}

/* ---------- Theme & menu & quote ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const dark = state.theme === 'dark';
  $('#themeBtn').textContent = dark ? '☀️' : '🌙';
  $('#themeBtn').setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}
$('#themeBtn').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); });
$('#menuBtn').addEventListener('click', () => {
  const open = $('#nav').classList.toggle('open');
  $('#menuBtn').setAttribute('aria-expanded', open);
});
document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => {
  $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false');
}));
const newQuote = () => { $('#quote').textContent = '“' + pick(QUOTES) + '”'; };
$('#quoteBtn').addEventListener('click', newQuote);

/* ---------- Timer ---------- */
let mode = 'focus', left = MODES.focus.s, endAt = 0, ticker = null;

function drawTimer() {
  const m = String(Math.floor(left / 60)).padStart(2, '0');
  const s = String(left % 60).padStart(2, '0');
  $('#time').textContent = `${m}:${s}`;
  $('#bar').style.strokeDashoffset = CIRC * (left / MODES[mode].s);
  document.title = ticker ? `${m}:${s} · FocusGarden` : 'FocusGarden Pro – grow a plant for every focus session';
}
function stop() { clearInterval(ticker); ticker = null; $('#startBtn').textContent = 'Start'; }
function setMode(next) {
  stop(); mode = next; left = MODES[mode].s;
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.mode === mode));
  drawTimer();
}
function complete() {
  const m = MODES[mode];
  beep();
  if (m.n === 0) { toast('Break over. Ready to focus? 💪'); setMode('focus'); return; }
  const t = dayKey();
  rollDay();
  state.sessions++; state.today++; state.minutes += Math.round(m.s / 60);
  for (let i = 0; i < m.n; i++) state.plants.push(pick(m.n > 1 ? BIG : SMALL));
  if (state.lastDay !== t) {                            // streak = days in a row
    state.streak = state.lastDay === dayKey(new Date(Date.now() - 864e5)) ? state.streak + 1 : 1;
    state.lastDay = t;
  }
  save(); renderAll();
  toast(m.n > 1 ? '🌳 A tree grew in your garden!' : '🌱 A new plant grew in your garden!');
  setMode('break');
}
function tick() {
  left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  drawTimer();
  if (left === 0) complete();
}
$('#startBtn').addEventListener('click', () => {
  if (ticker) { stop(); drawTimer(); return; }          // pause
  endAt = Date.now() + left * 1000;
  ticker = setInterval(tick, 250);
  $('#startBtn').textContent = 'Pause';
});
$('#resetBtn').addEventListener('click', () => setMode(mode));
document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => setMode(c.dataset.mode)));

/* ---------- Tasks ---------- */
const PRIO = { high: 'High', med: 'Medium', low: 'Low' };
function drawTasks() {
  const list = $('#taskList');
  list.replaceChildren();
  state.tasks.forEach((t, i) => {
    const li = document.createElement('li');
    li.className = `p-${t.p}` + (t.done ? ' done' : '');
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = t.done;
    box.setAttribute('aria-label', `Mark "${t.text}" as done`);
    box.addEventListener('change', () => {
      t.done = box.checked; state.tasksDone += t.done ? 1 : -1;
      save(); drawTasks(); drawStats();
    });
    const label = document.createElement('span'); label.textContent = t.text;
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = PRIO[t.p];
    const del = document.createElement('button');
    del.className = 'del'; del.textContent = '🗑️'; del.setAttribute('aria-label', `Delete "${t.text}"`);
    del.addEventListener('click', () => {
      if (t.done) state.tasksDone = Math.max(0, state.tasksDone - 1);
      state.tasks.splice(i, 1); save(); drawTasks(); drawStats();
    });
    li.append(box, label, tag, del);
    list.append(li);
  });
  const done = state.tasks.filter((t) => t.done).length;
  $('#taskEmpty').hidden = state.tasks.length > 0;
  $('#taskCount').textContent = state.tasks.length ? `${done} of ${state.tasks.length} done` : '';
}
$('#taskForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#taskInput').value.trim();
  if (!text) return;
  state.tasks.push({ text, p: $('#prio').value, done: false });
  $('#taskInput').value = '';
  save(); drawTasks();
});
$('#clearDone').addEventListener('click', () => {
  state.tasks = state.tasks.filter((t) => !t.done);
  save(); drawTasks();
});

/* ---------- Garden, goal & stats ---------- */
function drawGarden() {
  const box = $('#plants');
  box.replaceChildren();
  state.plants.slice(-80).forEach((emoji, i) => {
    const p = document.createElement('span');
    p.className = 'plant'; p.textContent = emoji; p.setAttribute('aria-hidden', 'true');
    p.style.animationDelay = Math.min(i, 20) * 30 + 'ms';
    box.append(p);
  });
  $('#gardenMsg').textContent = state.plants.length
    ? `${state.plants.length} plants growing. Keep going!`
    : 'Your garden is empty. Finish a focus session to plant your first seed!';
}
function drawGoal() {
  const pct = Math.min(100, Math.round((state.today / state.goal) * 100));
  $('#goalBar').style.width = pct + '%';
  $('#goalBar').parentElement.setAttribute('aria-valuenow', pct);
  $('#goalText').textContent = state.today >= state.goal
    ? `🎉 Goal reached! ${state.today} sessions today` : `${state.today} / ${state.goal} sessions`;
}
function currentStreak() {
  const ok = state.lastDay === dayKey() || state.lastDay === dayKey(new Date(Date.now() - 864e5));
  return ok ? state.streak : 0;
}
function drawStats() {
  let rank = RANKS[0][1];
  RANKS.forEach(([min, name]) => { if (state.sessions >= min) rank = name; });
  const next = RANKS.find(([min]) => min > state.sessions);
  const data = [[state.sessions, 'Sessions'], [state.minutes, 'Minutes focused'],
                ['🔥 ' + currentStreak(), 'Day streak'], [state.tasksDone, 'Tasks done'], [rank, 'Rank']];
  const tiles = $('#tiles');
  tiles.replaceChildren();
  data.forEach(([value, label]) => {
    const d = document.createElement('div'); d.className = 'tile';
    const b = document.createElement('b'); b.textContent = value;
    const s = document.createElement('span'); s.textContent = label;
    d.append(b, s); tiles.append(d);
  });
  $('#nextRank').textContent = next
    ? `${next[0] - state.sessions} more session(s) to become ${next[1]}.` : 'You are a Forest Keeper. Legend!';
}
function renderAll() { drawGarden(); drawGoal(); drawStats(); }
$('#resetAll').addEventListener('click', () => {
  if (!confirm('Reset your garden and stats? Tasks are kept.')) return;
  Object.assign(state, { plants: [], sessions: 0, minutes: 0, streak: 0, lastDay: '', today: 0, tasksDone: 0 });
  save(); renderAll();
});

/* ---------- Start ---------- */
rollDay(); applyTheme(); newQuote(); drawTimer(); drawTasks(); renderAll();
