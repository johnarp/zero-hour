/* ================= Rendering ================= */
function makeBgl() {
  const d = el('div', 'bgl'); d.append(el('div', 'l-color'), el('div', 'l-img'), el('div', 'l-scrim')); return d;
}
function paintBg(root, p) {
  const b = p.bg, c = $('.l-color', root), im = $('.l-img', root), sc = $('.l-scrim', root);
  if (b.type === 'gradient') c.style.background = `linear-gradient(${b.angle}deg, ${b.color}${b.mid ? ', ' + b.mid : ''}, ${b.color2})`;
  else c.style.background = b.color;
  if (b.type === 'image' && b.image) {
    const src = 'url(' + JSON.stringify(b.image) + ')';
    if (im.dataset.src !== b.image) { im.style.backgroundImage = src; im.dataset.src = b.image; }
    im.style.display = ''; im.style.filter = b.blur ? `blur(${b.blur}px)` : '';
    im.style.transform = b.blur ? `scale(${1 + b.blur * .006 + .02})` : '';
    sc.style.opacity = b.dim / 100;
  } else { im.style.display = 'none'; sc.style.opacity = 0; }
}
function applyTheme(node, p) {
  const f = FONTS.find(x => x.name === p.font) || FONTS[0], s = node.style;
  s.setProperty('--font', fontStack(p.font)); s.setProperty('--weight', p.weight); s.setProperty('--vc', f.vc);
  s.setProperty('--text', p.text); s.setProperty('--accent', p.accent);
  s.setProperty('--glow', p.glow); s.setProperty('--shadow', p.shadow);
  s.setProperty('--tw', clamp(p.weight, 300, 700)); s.setProperty('--ts', (p.titleSpacing / 100) + 'em');
}

class ClockView {
  constructor(root) { this.root = root; this.struct = ''; this.cells = []; this.first = true; this.fitSig = ''; this.mode = 'units'; }
  invalidate() { this.fitSig = ''; }
  build(p, list, bd, msg) {
    const r = this.root; r.textContent = ''; this.cells = [];
    r.classList.toggle('msg-mode', msg != null);
    if (msg != null) { this.mode = 'msg'; r.append(el('div', 'msg', msg)); return; }
    this.mode = 'units';
    list.forEach(([k, label], i) => {
      if (i) { const s = el('div', 'sep s-' + p.sep); s.setAttribute('aria-hidden', 'true'); if (p.sep === 'colon') s.append(el('i'), el('i')); else if (p.sep === 'dot' || p.sep === 'line') s.append(el('i')); r.append(s); }
      const u = el('div', 'unit'), dg = el('div', 'digits'), len = Math.max(2, String(bd[k]).length), spans = [];
      for (let j = 0; j < len; j++) { const d = el('span', 'd'); spans.push(d); dg.append(d); }
      u.append(dg); if (p.labels) u.append(el('div', 'lab', label));
      r.append(u); this.cells.push({ k, label, spans, len });
    });
  }
  update(p, now, animate) {
    const tgt = targetMs(p); let bd, msg = null, list = null;
    if (isNaN(tgt)) { bd = ZERO(); msg = 'Pick a date'; }
    else { bd = breakdown(now, tgt, p.units); if (bd.done && p.endMessage.trim()) msg = p.endMessage.trim(); }
    if (msg == null) list = activeUnits(p, bd);
    const struct = msg != null ? 'm:' + msg : list.map(([k]) => k + Math.max(2, String(bd[k]).length)).join('|') + '|' + p.sep + (p.labels ? 'L' : '');
    const changed = struct !== this.struct;
    if (changed) { this.build(p, list, bd, msg); this.struct = struct; this.fitSig = ''; this.first = true; }
    if (msg == null) {
      for (const c of this.cells) {
        const s = String(bd[c.k]).padStart(c.len, '0');
        for (let j = 0; j < c.len; j++) {
          const d = c.spans[j];
          if (d.textContent !== s[j]) {
            d.textContent = s[j];
            if (animate && p.anim && !this.first) { d.classList.remove('tick'); void d.offsetWidth; d.classList.add('tick'); }
          }
        }
      }
      this.root.setAttribute('aria-label', this.cells.map(c => bd[c.k] + ' ' + c.label.toLowerCase()).join(', '));
    } else this.root.setAttribute('aria-label', msg);
    this.first = false; return changed;
  }
  fit(aw, ah, o) {
    const sig = [this.struct, aw | 0, ah | 0, o.scale, o.allowGrid, o.font].join('~');
    if (sig === this.fitSig || aw < 20 || ah < 20) return; this.fitSig = sig;
    const r = this.root; r.classList.remove('grid'); r.style.setProperty('--fs', '100px');
    if (this.mode === 'msg') {
      const nw = r.scrollWidth || 1, nh = r.offsetHeight || 1;
      r.style.setProperty('--fs', clamp(Math.min(aw / nw, ah / nh) * 100 * o.scale, 10, o.cap) + 'px'); return;
    }
    const units = [...r.querySelectorAll('.unit')], n = units.length; if (!n) return;
    const rowW = r.scrollWidth || 1, uW = Math.max(...units.map(u => u.offsetWidth)), uH = Math.max(...units.map(u => u.offsetHeight)) || 1;
    let best = { r: 1, cols: n, fs: Math.min(aw / rowW, ah / uH) * 100 };
    if (o.allowGrid) for (let rows = 2; rows <= Math.min(3, n); rows++) {
      const cols = Math.ceil(n / rows), w = cols * uW + (cols - 1) * 30, h = rows * uH + (rows - 1) * 24, fs = Math.min(aw / w, ah / h) * 100;
      if (fs > best.fs * (best.r === 1 && best.fs >= 80 ? 2 : 1.15)) best = { r: rows, cols, fs };
    }
    r.style.setProperty('--fs', clamp(best.fs * o.scale, 10, o.cap) + 'px');
    if (best.r > 1) { r.style.setProperty('--cols', best.cols); r.style.setProperty('--uw', (uW / 100) + 'em'); r.classList.add('grid'); }
  }
}

/* ---- Stage ---- */
const stageEl = $('#stage'), clockEl = $('#clock'), titleEl = $('#title'), tagEl = $('#tagline'), innerEl = $('#inner');
const stageClock = new ClockView(clockEl);

function layoutStage() {
  const p = cur(); if (!p) return;
  const cs = getComputedStyle(innerEl), padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const w = innerEl.clientWidth - padX, h = innerEl.clientHeight;
  if (w < 20 || h < 20) return;
  const tfs = clamp(w * .03, 13, 42);
  innerEl.style.setProperty('--tfs', tfs + 'px'); innerEl.style.setProperty('--gfs', clamp(tfs * .62, 13, 21) + 'px');
  const blocks = [!titleEl.hidden, true, !tagEl.hidden].filter(Boolean).length;
  const used = (titleEl.hidden ? 0 : titleEl.offsetHeight) + (tagEl.hidden ? 0 : tagEl.offsetHeight) + (blocks - 1) * 26;
  stageClock.fit(w, Math.max(40, h - used), { allowGrid: p.layout !== 'row', scale: p.size / 100, cap: 560, font: p.font });
}
function renderStage() {
  const p = cur(); if (!p) return;
  applyTheme(stageEl, p); paintBg($('#bgl'), p);
  titleEl.textContent = p.name; titleEl.hidden = !p.name.trim();
  tagEl.textContent = p.tagline; tagEl.hidden = !p.tagline.trim();
  stageClock.update(p, Date.now(), false); stageClock.invalidate();
  layoutStage();
}
if ('ResizeObserver' in window) new ResizeObserver(() => layoutStage()).observe(innerEl);
window.addEventListener('resize', layoutStage);
if (document.fonts) {
  document.fonts.addEventListener('loadingdone', () => { stageClock.invalidate(); layoutStage(); cards.forEach(c => c.view.invalidate()); });
}

/* ---- Library (grid of countdowns) ---- */
let cards = [];
// Order for the grid. Upcoming countdowns come first (soonest or furthest); finished ones always go last.
function sortedPresets() {
  const now = Date.now(), L = [...state.presets], t = p => targetMs(p);
  if (state.sort === 'added') return L;
  if (state.sort === 'name') return L.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  const up = L.filter(p => t(p) > now), done = L.filter(p => !(t(p) > now));
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });   // tie-break: same moment sorts A to Z
  up.sort((a, b) => (state.sort === 'furthest' ? t(b) - t(a) : t(a) - t(b)) || byName(a, b));
  done.sort((a, b) => ((t(b) || 0) - (t(a) || 0)) || byName(a, b));
  return [...up, ...done];
}
function renderLibrary() {
  $('#libSort').value = state.sort;
  const grid = $('#grid'); grid.textContent = ''; cards = [];
  for (const p of sortedPresets()) {
    const card = el('div', 'card'); card.tabIndex = 0; card.setAttribute('role', 'button'); card.setAttribute('aria-label', 'Show ' + p.name);
    const bgl = makeBgl(); paintBg(bgl, p); card.append(bgl);
    const cc = el('div', 'cc'), clock = el('div', 'clock'); applyTheme(card, p); cc.append(clock); card.append(cc);
    card.append(el('div', 'shade'));
    if (p.id === state.activeId) card.append(el('div', 'live', 'Showing'));
    const meta = el('div', 'meta'), tx = el('div'), nm = el('strong', null, p.name || 'Untitled'), dt = el('small', null, fmtDate(p));
    tx.append(nm, dt);
    const ed = el('button', 'edit'); ed.type = 'button'; ed.setAttribute('aria-label', 'Edit ' + p.name);
    ed.innerHTML = '<svg class="i" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>Edit';
    meta.append(tx, ed); card.append(meta);
    const view = new ClockView(clock); view.update(p, Date.now(), false);
    const open = () => { state.activeId = p.id; save(); showView('watch'); renderStage(); Music.sync(cur()); };
    card.addEventListener('click', e => { if (e.target.closest('.edit')) return; open(); });
    card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); open(); } });
    ed.addEventListener('click', () => { state.activeId = p.id; save(); showView('watch'); renderStage(); Music.sync(cur()); openEditor(); });
    grid.append(card); cards.push({ p, card, view });
  }
  const nw = el('button', 'card new'); nw.type = 'button';
  nw.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg><span>New countdown</span>';
  nw.addEventListener('click', () => { const p = normalize(Object.assign(defaults(), {})); state.presets.push(p); state.activeId = p.id; save(); showView('watch'); renderStage(); Music.sync(cur()); openEditor(); });
  grid.append(nw);
  tickCards(true);
}
function tickCards() {
  if (!document.body.classList.contains('lib')) return;
  const now = Date.now();
  for (const c of cards) {
    c.view.update(c.p, now, false);
    const w = c.card.clientWidth, h = c.card.clientHeight;
    c.view.fit(w * .88, h * .36, { allowGrid: false, scale: 1, cap: 90, font: c.p.font });
  }
}