'use strict';

/* ================= Editor ================= */
let P = null, controls = [], lastTab = 'Countdown', musicDebounce = 0, imgDebounce = 0;
const getP = path => path.split('.').reduce((o, k) => o[k], P);
function setP(path, v) { const ks = path.split('.'), last = ks.pop(); ks.reduce((o, k) => o[k], P)[last] = v; }
function commit(path, v) { setP(path, v); afterChange(path); }
function afterChange(path) {
  renderStage();
  if (path.startsWith('music')) { clearTimeout(musicDebounce); if (path === 'music.url') musicDebounce = setTimeout(() => { Music.sync(P); updateHints(); }, 450); else Music.sync(P); }
  save(); syncWhen(); updateHints();
}
function syncWhen() {
  document.querySelectorAll('#panes [data-when]').forEach(n => {
    const v = getP(n.dataset.when), is = n.dataset.is;
    n.classList.toggle('when-off', !(is === '*' ? !!v : is.split(',').includes(String(v))));
  });
}
function reg(sync) { controls.push({ sync }); sync(); }
function fld(label, ctl, extra) {
  const f = el('div', 'fld'); if (label) { const l = el('div', 'lbl', label); f.append(l); f._lbl = l; } f.append(ctl); if (extra) f.append(extra); return f;
}
function when(node, path, is) { node.dataset.when = path; node.dataset.is = is; return node; }
let idc = 0; const nid = () => 'f' + (++idc);

function fText(path, label, o = {}) {
  const i = el('input', 'in'); i.type = 'text'; i.id = nid(); i.maxLength = o.max || 120; if (o.ph) i.placeholder = o.ph; i.autocomplete = 'off';
  i.addEventListener('input', () => commit(path, i.value));
  reg(() => { if (i.value !== getP(path)) i.value = getP(path); });
  const f = fld(null, i); const lb = el('label', null, label); lb.htmlFor = i.id; f.prepend(lb); return f;
}
function fSelect(path, label, opts, o = {}) {
  const s = el('select', 'in'); s.id = nid();
  for (const x of opts) { const op = el('option', null, x.t); op.value = x.v; s.append(op); }
  s.addEventListener('change', () => commit(path, o.num ? +s.value : s.value));
  reg(() => { const v = String(getP(path)); if (![...s.options].some(x => x.value === v)) { const op = el('option', null, v); op.value = v; s.append(op); } s.value = v; });
  const f = fld(null, s); const lb = el('label', null, label); lb.htmlFor = s.id; f.prepend(lb); return f;
}
function fRange(path, label, min, max, step, fmt) {
  const r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.id = nid();
  const out = el('output'); const f = fld(null, r); const lb = el('label'); lb.htmlFor = r.id; lb.append(el('span', null, label), out); f.prepend(lb);
  const show = () => { out.textContent = fmt ? fmt(+r.value) : r.value; };
  r.addEventListener('input', () => { show(); commit(path, +r.value); });
  reg(() => { r.value = getP(path); show(); }); return f;
}
function fColor(path, label) {
  const w = el('div', 'colorf'), c = el('input'); c.type = 'color'; c.setAttribute('aria-label', label + ' picker');
  const t = el('input', 'in'); t.type = 'text'; t.maxLength = 7; t.id = nid(); t.autocomplete = 'off'; t.spellcheck = false;
  c.addEventListener('input', () => { t.value = c.value; commit(path, c.value); });
  t.addEventListener('input', () => { const h = hex(t.value.startsWith('#') ? t.value : '#' + t.value, null); if (h) { c.value = h; commit(path, h); } });
  t.addEventListener('blur', () => { t.value = getP(path); });
  w.append(c, t);
  reg(() => { const v = getP(path) || '#000000'; c.value = v; if (document.activeElement !== t) t.value = v; });
  const f = fld(null, w); const lb = el('label', null, label); lb.htmlFor = t.id; f.prepend(lb); return f;
}
function fSwitch(path, label, o = {}) {
  const row = el('div', 'sw'), sp = el('span', null, label), b = el('button'); b.type = 'button'; b.setAttribute('role', 'switch');
  b.setAttribute('aria-label', label);
  b.addEventListener('click', () => { const on = b.getAttribute('aria-checked') !== 'true'; if (o.set) o.set(on); else commit(path, on); b.setAttribute('aria-checked', on); });
  row.append(sp, b);
  reg(() => b.setAttribute('aria-checked', o.get ? o.get() : !!getP(path))); return row;
}
function fSeg(path, label, opts) {
  const s = el('div', 'seg'); s.setAttribute('role', 'radiogroup'); s.setAttribute('aria-label', label);
  const bs = opts.map(x => { const b = el('button', null, x.t); b.type = 'button'; b.setAttribute('role', 'radio'); b.addEventListener('click', () => { commit(path, x.v); bs.forEach(y => y.b.setAttribute('aria-checked', y.v === x.v)); }); s.append(b); return { v: x.v, b }; });
  reg(() => bs.forEach(y => y.b.setAttribute('aria-checked', y.v === getP(path))));
  return fld(label, s);
}
const tzOpts = () => {
  let z; try { z = Intl.supportedValuesOf('timeZone'); } catch (e) { z = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney']; }
  return [{ v: 'local', t: 'Device time zone' }, { v: 'UTC', t: 'UTC' }, ...z.filter(x => x !== 'UTC').map(x => ({ v: x, t: x.replace(/_/g, ' ') }))];
};

function lum(h) { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4)); return .2126 * r + .7152 * g + .0722 * b; }
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
function updateHints() {
  const h = $('#hintTarget'), c = $('#hintContrast'), m = $('#hintMusic'); if (!P) return;
  if (h) {
    const t = targetMs(P);
    if (isNaN(t)) h.textContent = 'Pick a valid date and time.';
    else { let s = 'Counts down to ' + new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date(t)) + ' your time.'; if (t <= Date.now()) s += ' That moment has passed, so the finish message shows.'; h.textContent = s; }
  }
  if (c) {
    const b = P.bg; c.className = 'hint';
    if (b.type === 'image') c.textContent = 'On photos, raise Dim or Text shadow if the clock is hard to read.';
    else {
      const cols = b.type === 'gradient' ? [b.color, b.color2, b.mid].filter(Boolean) : [b.color];
      const min = Math.min(...cols.map(x => ratio(P.text, x)));
      if (min < 3) { c.classList.add('warn'); c.textContent = 'Low contrast between text and background. Pick a lighter or darker text color.'; } else c.textContent = '';
    }
  }
  if (m) m.textContent = musicNote(P.music.url);
}

function buildSheet() {
  controls = []; const tabs = $('#tabs'), panes = $('#panes'); tabs.textContent = ''; panes.textContent = '';
  const defs = [['Countdown', paneCountdown], ['Style', paneStyle], ['Background', paneBackground], ['Music', paneMusic]];
  const show = name => { lastTab = name; tabs.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.textContent === name)); panes.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.tab === name)); panes.scrollTop = 0; };
  for (const [name, fn] of defs) {
    const t = el('button', 'tab', name); t.type = 'button'; t.setAttribute('role', 'tab'); t.addEventListener('click', () => show(name)); tabs.append(t);
    const pn = el('div', 'pane'); pn.dataset.tab = name; fn(pn); panes.append(pn);
  }
  show(lastTab); syncWhen(); updateHints();
}
function paneCountdown(pn) {
  pn.append(fText('name', 'Name', { ph: 'Type it the way it should look: Dune or DUNE' }), fText('tagline', 'Tagline (optional)', { ph: 'Shown under the clock', max: 200 }));
  const d = el('div', 'two'), dt = el('input', 'in'), tm = el('input', 'in'); dt.type = 'date'; tm.type = 'time'; dt.id = nid(); tm.id = nid();
  dt.addEventListener('input', () => commit('date', dt.value)); tm.addEventListener('input', () => commit('time', tm.value));
  reg(() => { dt.value = P.date; tm.value = P.time; });
  const f1 = fld(null, dt), l1 = el('label', null, 'Date'); l1.htmlFor = dt.id; f1.prepend(l1);
  const f2 = fld(null, tm), l2 = el('label', null, 'Time'); l2.htmlFor = tm.id; f2.prepend(l2); d.append(f1, f2);
  const hint = el('p', 'hint'); hint.id = 'hintTarget';
  pn.append(d, hint, fSelect('tz', 'Time zone', tzOpts()));
  const ch = el('div', 'chips'); ch.setAttribute('role', 'group');
  for (const [k, label] of UNIT_META) {
    const b = el('button', 'chipbtn', label); b.type = 'button';
    b.addEventListener('click', () => {
      const on = !P.units[k]; if (!on && Object.values(P.units).filter(Boolean).length === 1) { toast('Keep at least one unit on.'); return; }
      P.units[k] = on; b.setAttribute('aria-pressed', on); afterChange('units');
    });
    reg(() => b.setAttribute('aria-pressed', !!P.units[k])); ch.append(b);
  }
  pn.append(fld('Show', ch), fSwitch('hideLeading', 'Hide leading units that reach zero'), fText('endMessage', 'Message when it finishes', { ph: "It's here.", max: 160 }));
}
function paneStyle(pn) {
  const th = el('div', 'themes');
  for (const t of THEMES) {
    const b = el('button', 'theme'); b.type = 'button'; b.setAttribute('aria-label', 'Apply ' + t.name + ' theme');
    b.style.background = `linear-gradient(${t.angle}deg, ${t.c[0]}${t.mid ? ',' + t.mid : ''}, ${t.c[1]})`;
    const s = el('b', null, '09'); s.style.color = t.text; s.style.textShadow = `0 0 12px ${t.accent}66`; b.append(s, el('span', null, t.name));
    b.addEventListener('click', () => { themed(P, t); controls.forEach(c => c.sync()); afterChange('theme'); });
    th.append(b);
  }
  pn.append(fld('Quick themes', th));
  pn.append(fSelect('font', 'Font', FONTS.map(f => ({ v: f.name, t: f.name + '  ·  ' + f.note }))));
  const two = el('div', 'two'); two.append(fColor('text', 'Text'), fColor('accent', 'Accent')); pn.append(two);
  const ch = el('p', 'hint'); ch.id = 'hintContrast'; pn.append(ch);
  pn.append(fRange('weight', 'Weight', 100, 900, 100), fRange('size', 'Size', 40, 100, 5, v => v + '%'), fRange('titleSpacing', 'Title letter spacing', 0, 50, 1, v => (v / 100).toFixed(2) + ' em'), fRange('glow', 'Glow', 0, 100, 5), fRange('shadow', 'Text shadow', 0, 100, 5));
  pn.append(fSeg('sep', 'Separator', [{ v: 'colon', t: 'Colon' }, { v: 'dot', t: 'Dot' }, { v: 'slash', t: 'Slash' }, { v: 'line', t: 'Line' }, { v: 'none', t: 'None' }]));
  pn.append(fSeg('layout', 'Layout on small screens', [{ v: 'auto', t: 'Wrap to fit' }, { v: 'row', t: 'Always one row' }]));
  pn.append(fSwitch('labels', 'Unit labels (Days, Hours…)'), fSwitch('anim', 'Animate digits'));
}
function paneBackground(pn) {
  pn.append(fSeg('bg.type', 'Type', [{ v: 'solid', t: 'Color' }, { v: 'gradient', t: 'Gradient' }, { v: 'image', t: 'Image' }]));
  pn.append(when(fColor('bg.color', 'Color'), 'bg.type', 'solid,image'));
  const g = el('div', 'two'); g.append(fColor('bg.color', 'From'), fColor('bg.color2', 'To')); when(g, 'bg.type', 'gradient'); pn.append(g);
  pn.append(when(fSwitch('', 'Middle color', { get: () => !!P.bg.mid, set: on => { commit('bg.mid', on ? (P.bg.mid || '#7b2cbf') : ''); controls.forEach(c => c.sync()); } }), 'bg.type', 'gradient'));
  pn.append(when(fColor('bg.mid', 'Middle'), 'bg.mid', '*'));
  pn.append(when(fRange('bg.angle', 'Angle', 0, 360, 5, v => v + '°'), 'bg.type', 'gradient'));
  const img = el('div', 'fld'); when(img, 'bg.type', 'image');
  const row = el('div', 'filebtn'), up = el('button', 'btn', 'Upload image'), rm = el('button', 'btn', 'Remove'); up.type = rm.type = 'button';
  up.addEventListener('click', () => $('#imgFile').click());
  rm.addEventListener('click', () => { P.bg.image = ''; controls.forEach(c => c.sync()); afterChange('bg.image'); });
  row.append(up, rm);
  const url = el('input', 'in'); url.type = 'text'; url.id = nid(); url.placeholder = 'Or paste an image address (https://…)'; url.autocomplete = 'off';
  url.addEventListener('input', () => {
    const v = url.value.trim(); if (!/^https?:\/\//i.test(v)) return; commit('bg.image', v);
    clearTimeout(imgDebounce); imgDebounce = setTimeout(() => { const t = new Image(); t.onerror = () => toast('That image did not load. Upload the file instead.'); t.src = v; }, 700);
  });
  const note = el('p', 'hint'); reg(() => { const v = P.bg.image; url.value = v.startsWith('data:') ? '' : v; note.textContent = v.startsWith('data:') ? 'Using an uploaded image (saved in this browser).' : v ? '' : 'Uploads are resized to fit browser storage.'; });
  img.append(el('div', 'lbl', 'Image'), row, url, note); pn.append(img);
  pn.append(when(fRange('bg.dim', 'Dim', 0, 90, 5, v => v + '%'), 'bg.type', 'image'), when(fRange('bg.blur', 'Blur', 0, 30, 1, v => v + 'px'), 'bg.type', 'image'));
}
function paneMusic(pn) {
  pn.append(fText('music.url', 'YouTube link or audio file address', { ph: 'https://www.youtube.com/watch?v=…', max: 500 }));
  const h = el('p', 'hint'); h.id = 'hintMusic'; pn.append(h);
  pn.append(fRange('music.volume', 'Volume', 0, 100, 5, v => v + '%'), fSwitch('music.loop', 'Loop'), fSwitch('music.autostart', 'Start on the first tap or key press'));
  pn.append(fSeg('music.pos', 'Tile position', [{ v: 'bottom-left', t: 'Left' }, { v: 'bottom-center', t: 'Center' }, { v: 'bottom-right', t: 'Right' }]));
  pn.append(el('p', 'hint', 'Browsers block sound until you interact with the page, so music always starts from a tap.'));
}

function openEditor() {
  P = cur(); if (!P) return; buildSheet();
  document.body.classList.add('editing'); document.body.classList.remove('idle');
  setTimeout(layoutStage, 320);
}
function closeEditor() {
  if (!document.body.classList.contains('editing')) return;
  document.body.classList.remove('editing'); save(true); setTimeout(layoutStage, 320); wake();
  const dd = $('#btnDel'); dd.classList.remove('arm'); dd.textContent = 'Delete';
}
$('#btnDone').addEventListener('click', closeEditor);
$('#btnDup').addEventListener('click', () => {
  const c = normalize(JSON.parse(JSON.stringify(P))); c.id = uid(); c.name = (P.name || 'Countdown') + ' copy';
  state.presets.splice(state.presets.indexOf(P) + 1, 0, c); state.activeId = c.id; save(); renderStage(); Music.sync(c); openEditor(); toast('Duplicated.');
});
let delTimer = 0;
$('#btnDel').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = 'Tap again to delete'; clearTimeout(delTimer); delTimer = setTimeout(() => { b.classList.remove('arm'); b.textContent = 'Delete'; }, 3000); return; }
  clearTimeout(delTimer); b.classList.remove('arm'); b.textContent = 'Delete';
  const i = state.presets.indexOf(P); state.presets.splice(i, 1);
  if (!state.presets.length) state.presets.push(normalize(defaults()));
  state.activeId = state.presets[Math.min(i, state.presets.length - 1)].id; save(true);
  closeEditor(); renderStage(); Music.sync(cur());
});
$('#imgFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f || !P) return;
  try { const out = await processImage(f); P.bg.image = out; P.bg.type = 'image'; controls.forEach(c => c.sync()); afterChange('bg.image'); }
  catch (err) { toast('Could not read that image.'); }
});
async function processImage(file) {
  const u = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const s = Math.min(1, 1920 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const x = c.getContext('2d'); x.fillStyle = P.bg.color; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
  let q = .82, out = c.toDataURL('image/jpeg', q); while (out.length > 1.2e6 && q > .45) { q -= .1; out = c.toDataURL('image/jpeg', q); } return out;
}

/* ================= Export / Import ================= */
function exportText() { return JSON.stringify({ app: 'zero-hour', version: 1, exportedAt: new Date().toISOString(), activeId: state.activeId, presets: state.presets }, null, 2); }
$('#btnExport').addEventListener('click', () => {
  const t = exportText(); $('#expText').value = t;
  $('#expInfo').textContent = `${state.presets.length} countdown${state.presets.length === 1 ? '' : 's'} · ${(t.length / 1024).toFixed(t.length > 10240 ? 0 : 1)} KB. Backgrounds and settings are included.`;
  $('#dlgExport').showModal();
});
$('#expClose').addEventListener('click', () => $('#dlgExport').close());
$('#expCopy').addEventListener('click', async () => {
  const ta = $('#expText');
  try { await navigator.clipboard.writeText(ta.value); toast('Copied to clipboard.'); }
  catch (e) { ta.focus(); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {} toast(ok ? 'Copied to clipboard.' : 'Select the text and copy it with Ctrl or Cmd + C.'); }
});
$('#expDl').addEventListener('click', async () => {
  const text = $('#expText').value, name = 'countdowns-' + isoDate(new Date()) + '.json';
  try {
    const c = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (c) { await c.save({ filename: name, data: new Blob([text], { type: 'application/json' }) }); return; }
  } catch (e) { if (e && e.code === 'declined') return; }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.append(a); a.click(); a.remove(); }
  catch (e) { toast('Download is blocked here. Use Copy JSON instead.'); }
});
$('#btnImport').addEventListener('click', () => { $('#impText').value = ''; $('#impErr').textContent = ''; $('#dlgImport').showModal(); });
$('#impClose').addEventListener('click', () => $('#dlgImport').close());
$('#impPick').addEventListener('click', () => $('#impFile').click());
$('#impFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) { try { $('#impText').value = await f.text(); $('#impErr').textContent = ''; } catch (er) { $('#impErr').textContent = 'Could not read that file.'; } } });
$('#impGo').addEventListener('click', () => {
  const err = $('#impErr'); err.textContent = '';
  let j; try { j = JSON.parse($('#impText').value); } catch (e) { err.textContent = 'That is not valid JSON. Paste the full export, or choose the file.'; return; }
  const arr = Array.isArray(j) ? j : Array.isArray(j.presets) ? j.presets : (j && typeof j === 'object' && j.name !== undefined ? [j] : null);
  if (!arr || !arr.length) { err.textContent = 'No countdowns found in that JSON.'; return; }
  const list = arr.slice(0, 200).map(normalize), mode = document.querySelector('input[name="impMode"]:checked').value;
  if (mode === 'replace') { state.presets = list; state.activeId = list.some(x => x.id === j.activeId) ? j.activeId : list[0].id; }
  else { const ids = new Set(state.presets.map(x => x.id)); for (const p of list) { if (ids.has(p.id)) p.id = uid(); ids.add(p.id); state.presets.push(p); } state.activeId = list[0].id; }
  save(true); $('#dlgImport').close(); renderLibrary(); renderStage(); Music.sync(cur()); toast(`Imported ${list.length} countdown${list.length === 1 ? '' : 's'}.`);
});
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

