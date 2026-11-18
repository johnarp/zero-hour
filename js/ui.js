'use strict';
/* ================= Views, idle chrome, fullscreen ================= */
let viewGuard = false;
function showView(v) {
  const lib = v === 'library';
  if (lib) closeEditor();
  document.body.classList.toggle('lib', lib);
  if (lib) { renderLibrary(); $('#library').scrollTop = 0; }
  try { viewGuard = true; const h = lib ? 'countdowns' : 'watch'; if (location.hash.slice(1) !== h) location.hash = h; } catch (e) {}
  setTimeout(() => { viewGuard = false; }, 0);
  wake();
}
window.addEventListener('hashchange', () => {
  if (viewGuard) return;
  const lib = location.hash.slice(1) === 'countdowns';
  if (lib !== document.body.classList.contains('lib')) { if (lib) closeEditor(); document.body.classList.toggle('lib', lib); if (lib) renderLibrary(); }
});
let idleTimer = 0;
function wake() {
  document.body.classList.remove('idle'); clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!document.body.classList.contains('editing') && !document.body.classList.contains('lib')) document.body.classList.add('idle'); }, 3200);
}
['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach(t => window.addEventListener(t, wake, { passive: true }));
$('#btnLib').addEventListener('click', () => showView('library'));
$('#libBack').addEventListener('click', () => showView('watch'));
$('#btnEdit').addEventListener('click', () => openEditor());
$('#btnFs').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch (e) { toast('Fullscreen is not available in this view.'); }
});
if (!document.fullscreenEnabled) $('#btnFs').hidden = true;
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || ''));
  if (document.querySelector('dialog[open]')) return;
  if (e.key === 'Escape') { if (document.body.classList.contains('editing')) closeEditor(); else if (document.body.classList.contains('lib')) showView('watch'); }
  else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'f' || e.key === 'F') && !$('#btnFs').hidden) $('#btnFs').click();
});

$('#libSort').addEventListener('change', e => { state.sort = SORTS.includes(e.target.value) ? e.target.value : 'soonest'; save(); renderLibrary(); });