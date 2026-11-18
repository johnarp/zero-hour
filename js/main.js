'use strict';
/* ================= Boot ================= */
function tick() {
  const p = cur(); if (p) { if (stageClock.update(p, Date.now(), true)) layoutStage(); }
  tickCards(); setTimeout(tick, 1000 - (Date.now() % 1000) + 8);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { const p = cur(); if (p) stageClock.update(p, Date.now(), false); tickCards(); } });
load(); renderStage(); Music.sync(cur());
if (location.hash.slice(1) === 'countdowns') { document.body.classList.add('lib'); renderLibrary(); }
if (!storageOK) toast('This browser is not saving changes. Use Export to keep a copy.');
tick(); wake();

// Installable app: only on http(s) (including localhost). Silently skipped in file:// and sandboxed previews.
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} }