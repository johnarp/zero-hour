'use strict';
/* ================= Data & helpers ================= */
const APP_NAME = 'Zero Hour';
// Storage key kept from the first build so saved countdowns carry over.
const KEY = 'countdown-studio:v1';
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => 'p' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

const FONTS = [
  { name: 'Bebas Neue', note: 'Cinematic', vc: .5 },
  { name: 'Big Shoulders Display', note: 'Condensed', vc: .5 },
  { name: 'Barlow Condensed', note: 'Sport', vc: .5 },
  { name: 'Manrope', note: 'Clean', vc: .5 },
  { name: 'Unbounded', note: 'Wide', vc: .5 },
  { name: 'Playfair Display', note: 'Serif', vc: .5 },
  { name: 'Orbitron', note: 'Sci-fi', vc: .5 },
  { name: 'JetBrains Mono', note: 'Mono', vc: .5 },
];
const fontStack = n => `'${n}', 'Bebas Neue', Impact, ui-sans-serif, system-ui, sans-serif`;

const THEMES = [
  { name: 'Midnight', c: ['#0a0c14', '#1a1f38'], mid: '', angle: 180, text: '#f3f5fa', accent: '#8ea8ff', glow: 20, shadow: 30 },
  { name: 'Vice', c: ['#2a0a4d', '#ff8a3d'], mid: '#d81b73', angle: 170, text: '#fff5ec', accent: '#ffd3a8', glow: 25, shadow: 40 },
  { name: 'Doom', c: ['#050b07', '#17301f'], mid: '', angle: 180, text: '#e9f3ec', accent: '#6fcf97', glow: 35, shadow: 40 },
  { name: 'Ember', c: ['#150404', '#5a1410'], mid: '', angle: 180, text: '#ffece4', accent: '#ff7a4d', glow: 30, shadow: 35 },
  { name: 'Ocean', c: ['#021522', '#0d5a78'], mid: '', angle: 165, text: '#eafcff', accent: '#62e3ea', glow: 25, shadow: 35 },
  { name: 'Gold', c: ['#0d0a05', '#33270b'], mid: '', angle: 180, text: '#f8ecc9', accent: '#e3b24f', glow: 25, shadow: 35 },
  { name: 'Paper', c: ['#f3f1ec', '#f3f1ec'], mid: '', angle: 180, text: '#14141a', accent: '#d9381e', glow: 0, shadow: 0 },
  { name: 'Mono', c: ['#000000', '#000000'], mid: '', angle: 180, text: '#ffffff', accent: '#ffffff', glow: 0, shadow: 0 },
];

function pad2(n) { return String(n).padStart(2, '0'); }
function isoDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function defaults() {
  const d = new Date(); d.setDate(d.getDate() + 30);
  return {
    id: uid(), name: 'New countdown', tagline: '', date: isoDate(d), time: '00:00', tz: 'local',
    units: { years: false, months: false, days: true, hours: true, minutes: true, seconds: true },
    hideLeading: false, labels: true, sep: 'colon', anim: true, layout: 'auto',
    font: 'Bebas Neue', weight: 400, size: 100, titleSpacing: 12,
    text: '#f3f5fa', accent: '#8ea8ff', glow: 20, shadow: 30,
    endMessage: "It's here.",
    bg: { type: 'gradient', color: '#0a0c14', color2: '#1a1f38', mid: '', angle: 180, image: '', dim: 35, blur: 0 },
    music: { url: '', volume: 70, loop: true, autostart: false, pos: 'bottom-center' },
  };
}
function themed(p, t) {
  Object.assign(p, { text: t.text, accent: t.accent, glow: t.glow, shadow: t.shadow });
  Object.assign(p.bg, { type: 'gradient', color: t.c[0], color2: t.c[1], mid: t.mid, angle: t.angle });
  return p;
}
function seed() {
  // Starter countdowns for a fresh browser. Dates are ones almost everyone has heard of.
  const ny = themed(defaults(), THEMES[6]);
  Object.assign(ny, { name: 'NEW YEAR 2027', titleSpacing: 30, tagline: 'See you on the other side.', date: '2027-01-01', endMessage: 'Happy New Year.', font: 'Manrope', weight: 300 });
  const xmas = themed(defaults(), THEMES[3]);
  Object.assign(xmas, { name: 'CHRISTMAS 2026', titleSpacing: 24, tagline: '\'Tis the season.', date: '2026-12-25', endMessage: 'Merry Christmas.', font: 'Playfair Display', weight: 500 });
  return [ny, xmas];
}

/* ---- Normalising anything that comes from storage or an imported file ---- */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
function hex(v, fb) {
  if (typeof v !== 'string' || !HEX.test(v.trim())) return fb;
  v = v.trim().toLowerCase();
  return v.length === 4 ? '#' + [...v.slice(1)].map(c => c + c).join('') : v;
}
const str = (v, fb, max = 200) => typeof v === 'string' ? v.slice(0, max) : fb;
const num = (v, fb, a, b) => { v = Number(v); return Number.isFinite(v) ? clamp(v, a, b) : fb; };
const bool = (v, fb) => typeof v === 'boolean' ? v : fb;
const pick = (v, list, fb) => list.includes(v) ? v : fb;
function normalize(raw) {
  const d = defaults(); if (!raw || typeof raw !== 'object') return d;
  const u = raw.units || {}, b = raw.bg || {}, m = raw.music || {};
  const units = {}; for (const k of Object.keys(d.units)) units[k] = bool(u[k], d.units[k]);
  if (!Object.values(units).some(Boolean)) units.days = true;
  const img = str(b.image, '', 6e6);
  // Countdowns saved by the first build had an "uppercase title" switch. Convert them so they look the same.
  let name = str(raw.name, d.name, 120), spacing = num(raw.titleSpacing, 12, 0, 50);
  if (raw.titleSpacing === undefined && raw.upper !== undefined) {
    if (raw.upper === false) spacing = 6; else { name = name.toUpperCase(); spacing = 30; }
  }
  return {
    id: str(raw.id, d.id, 40) || d.id,
    name, tagline: str(raw.tagline, '', 200),
    date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : d.date,
    time: /^\d{2}:\d{2}$/.test(raw.time) ? raw.time : '00:00',
    tz: str(raw.tz, 'local', 60) || 'local',
    units, hideLeading: bool(raw.hideLeading, false), labels: bool(raw.labels, true),
    sep: pick(raw.sep, ['colon', 'dot', 'slash', 'line', 'none'], 'colon'),
    anim: bool(raw.anim, true), layout: pick(raw.layout, ['auto', 'row'], 'auto'),
    font: FONTS.some(f => f.name === raw.font) ? raw.font : d.font,
    weight: num(raw.weight, 400, 100, 900), size: num(raw.size, 100, 40, 100), titleSpacing: spacing,
    text: hex(raw.text, d.text), accent: hex(raw.accent, d.accent),
    glow: num(raw.glow, d.glow, 0, 100), shadow: num(raw.shadow, d.shadow, 0, 100),
    endMessage: str(raw.endMessage, '', 160),
    bg: {
      type: pick(b.type, ['solid', 'gradient', 'image'], 'gradient'),
      color: hex(b.color, d.bg.color), color2: hex(b.color2, d.bg.color2), mid: b.mid ? hex(b.mid, '') : '',
      angle: num(b.angle, 180, 0, 360),
      image: /^(data:image\/|https?:\/\/)/i.test(img) ? img : '',
      dim: num(b.dim, 35, 0, 90), blur: num(b.blur, 0, 0, 30),
    },
    music: { url: str(m.url, '', 500), volume: num(m.volume, 70, 0, 100), loop: bool(m.loop, true), autostart: bool(m.autostart, false), pos: pick(m.pos, ['bottom-left', 'bottom-center', 'bottom-right'], 'bottom-center') },
  };
}

/* ================= Time maths ================= */
const dtfCache = {};
function tzOffset(epoch, tz) {
  const dtf = dtfCache[tz] || (dtfCache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const o = {}; for (const x of dtf.formatToParts(new Date(epoch))) o[x.type] = x.value;
  const asUTC = Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute, +o.second);
  return asUTC - Math.floor(epoch / 1000) * 1000;
}
function targetMs(p) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.date || ''), t = /^(\d{2}):(\d{2})$/.exec(p.time || '');
  if (!m || !t) return NaN;
  const [Y, Mo, D] = [+m[1], +m[2], +m[3]], [h, mi] = [+t[1], +t[2]];
  if (!p.tz || p.tz === 'local') return new Date(Y, Mo - 1, D, h, mi).getTime();
  try {
    const guess = Date.UTC(Y, Mo - 1, D, h, mi); let x = guess;
    for (let i = 0; i < 3; i++) { const nx = guess - tzOffset(x, p.tz); if (nx === x) break; x = nx; }
    return x;
  } catch (e) { return new Date(Y, Mo - 1, D, h, mi).getTime(); }
}
function addMonths(d, n) {
  const r = new Date(d), day = r.getDate(); r.setDate(1); r.setMonth(r.getMonth() + n);
  r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate())); return r;
}
const ZERO = () => ({ years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
function breakdown(now, target, u) {
  const out = ZERO(); out.done = false;
  if (!(target - now > 0)) { out.done = true; return out; }
  const remMs = Math.ceil((target - now) / 1000) * 1000;
  let cursor = new Date(target - remMs); const tgt = new Date(target);
  if (u.years || u.months) {
    let tm = (tgt.getFullYear() - cursor.getFullYear()) * 12 + tgt.getMonth() - cursor.getMonth();
    while (tm > 0 && addMonths(cursor, tm) > tgt) tm--;
    if (tm < 0) tm = 0;
    let used;
    if (u.years && u.months) { out.years = Math.floor(tm / 12); out.months = tm % 12; used = tm; }
    else if (u.years) { out.years = Math.floor(tm / 12); used = out.years * 12; }
    else { out.months = tm; used = tm; }
    cursor = addMonths(cursor, used);
  }
  let rem = target - cursor.getTime();
  const steps = [['days', 864e5], ['hours', 36e5], ['minutes', 6e4], ['seconds', 1e3]];
  for (const [k, ms] of steps) if (u[k]) { out[k] = Math.floor(rem / ms); rem -= out[k] * ms; }
  return out;
}
const UNIT_META = [['years', 'Years'], ['months', 'Months'], ['days', 'Days'], ['hours', 'Hours'], ['minutes', 'Minutes'], ['seconds', 'Seconds']];
function activeUnits(p, bd) {
  let list = UNIT_META.filter(([k]) => p.units[k]);
  if (!list.length) list = [UNIT_META[2]];
  if (p.hideLeading) while (list.length > 1 && bd[list[0][0]] === 0) list.shift();
  return list;
}
function fmtDate(p) {
  const t = targetMs(p); if (isNaN(t)) return 'No date set';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(t)); } catch (e) { return p.date; }
}

/* ================= State ================= */
const SORTS = ['soonest', 'furthest', 'name', 'added'];
let state = { activeId: null, presets: [], sort: 'soonest' };
let storageOK = true, saveTimer = 0;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      const list = (j.presets || []).map(normalize);
      if (list.length) { state = { activeId: list.some(x => x.id === j.activeId) ? j.activeId : list[0].id, presets: list, sort: SORTS.includes(j.sort) ? j.sort : 'soonest' }; return; }
    }
  } catch (e) { storageOK = false; }
  state.presets = seed().map(normalize); state.activeId = state.presets[0].id; save(true);
}
function save(now) {
  clearTimeout(saveTimer);
  const run = () => {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 1, activeId: state.activeId, sort: state.sort, presets: state.presets })); storageOK = true; }
    catch (e) { if (storageOK) toast(e && e.name === 'QuotaExceededError' ? 'Storage is full. Use a smaller background image.' : 'This browser is not saving changes. Use Export to keep a copy.'); storageOK = false; }
  };
  if (now) run(); else saveTimer = setTimeout(run, 250);
}
const cur = () => state.presets.find(p => p.id === state.activeId) || state.presets[0];

let toastTimer = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3600); }