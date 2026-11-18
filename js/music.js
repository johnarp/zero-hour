'use strict';
/* Music tile: YouTube (through YouTube's official IFrame Player API) or a direct audio file. */

function parseMusic(raw) {
  const u = (raw || '').trim(); if (!u) return null;
  let url; try { url = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); } catch (e) { return null; }
  const h = url.hostname.replace(/^(www|m|music)\./, ''), path = url.pathname;
  const list = url.searchParams.get('list'), okList = list && /^[\w-]{10,}$/.test(list) ? list : '';
  let id = '';
  if (h === 'youtu.be') id = path.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    if (path === '/watch') id = url.searchParams.get('v') || '';
    else { const m = path.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[2]; }
  }
  if (/^[\w-]{11}$/.test(id)) return { kind: 'youtube', id, list: okList };
  if (h === 'youtube.com' && path === '/playlist' && okList) return { kind: 'youtube', id: '', list: okList };
  if (/\.(mp3|m4a|ogg|oga|wav|aac|flac|opus)$/i.test(path)) return { kind: 'audio', url: url.href };
  return null;
}
function musicNote(raw) {
  const u = (raw || '').trim(); if (!u) return '';
  const i = parseMusic(u);
  if (i) {
    if (i.kind === 'audio') return 'Audio file found.';
    const base = i.list && !i.id ? 'YouTube playlist found.' : 'YouTube link found.';
    return location.protocol === 'file:' ? base + ' This page is open as a file, and YouTube will not play from one. Serve it over http (see the README).' : base;
  }
  if (/spotify\.com/i.test(u)) return 'Spotify links are not supported yet. Use a YouTube link.';
  return 'That is not a YouTube link or a direct audio file (.mp3, .m4a, .ogg, .wav).';
}

/* ---- YouTube player API loader ---- */
let ytLoader = null;
function loadYouTubeAPI() {
  if (ytLoader) return ytLoader;
  ytLoader = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') prev(); resolve(); };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { ytLoader = null; reject(new Error('blocked')); };
    document.head.append(s);
    setTimeout(() => { if (!(window.YT && window.YT.Player)) { ytLoader = null; reject(new Error('timeout')); } }, 12000);
  });
  return ytLoader;
}
const FILE_MSG = 'YouTube will not play from a page opened as a file. Run the app from a web server (see the README).';
const YT_ERRORS = {
  2: 'That YouTube link is not valid.',
  5: 'YouTube could not play this video in an embedded player.',
  100: 'That video is private or has been removed.',
  101: 'The owner of this video does not allow playback outside YouTube.',
  150: 'The owner of this video does not allow playback outside YouTube.',
  153: FILE_MSG,
};
const ytError = code => (code === 153 && location.protocol !== 'file:')
  ? 'YouTube refused to play here (error 153). Serve the app over https, or check that the page sends a referrer.'
  : (YT_ERRORS[code] || 'YouTube reported an error (' + code + ').');

const Music = {
  sig: '', info: null, player: null, host: null, audio: null, ready: false, playing: false, want: false,
  err: '', title: '', timer: 0, armFn: null, userPaused: false, gen: 0,

  sync(p) {
    const m = p.music, info = parseMusic(m.url), tile = $('#music');
    const sig = info ? JSON.stringify(info) + '|' + m.loop : '';
    if (sig !== this.sig) { this.teardown(); this.sig = sig; this.info = info; if (info) this.mount(m); }
    tile.hidden = !info; tile.dataset.pos = m.pos;
    if (info) { this.setVolume(m.volume); this.arm(m.autostart); }
    this.paint();
  },

  mount(m) {
    const i = this.info, gen = ++this.gen;
    if (i.kind === 'audio') {
      const a = this.audio = new Audio(i.url); a.loop = m.loop; a.preload = 'none'; a.volume = m.volume / 100;
      this.title = decodeURIComponent(i.url.split('/').pop().replace(/\.[^.]+$/, '')).slice(0, 60) || 'Audio';
      a.addEventListener('play', () => { this.playing = true; this.err = ''; this.paint(); });
      a.addEventListener('pause', () => { this.playing = false; this.paint(); });
      a.addEventListener('error', () => this.fail('That audio file could not be loaded.'));
      return;
    }
    this.title = 'YouTube';
    loadYouTubeAPI().then(() => { if (gen === this.gen) this.build(m, i); })
      .catch(() => { if (gen === this.gen) this.fail('Could not load the YouTube player. An ad blocker, a network rule or this page\'s security settings may be blocking it.', !this.want); });
  },
  build(m, i) {
    const host = this.host = el('div', 'yt-frame'), slot = el('div'); host.append(slot); document.body.append(host);
    const vars = { playsinline: 1, controls: 0, rel: 0, iv_load_policy: 3, disablekb: 1, fs: 0 };
    if (i.list) { vars.listType = 'playlist'; vars.list = i.list; } else if (m.loop) { vars.loop = 1; vars.playlist = i.id; }
    if (/^https?:/.test(location.origin)) vars.origin = location.origin;
    this.player = new YT.Player(slot, {
      width: 200, height: 200, videoId: i.id || undefined, playerVars: vars,
      events: { onReady: () => this.onReady(), onStateChange: e => this.onState(e.data), onError: e => this.fail(ytError(e.data)) },
    });
  },
  onReady() {
    this.ready = true; this.setVolume(cur().music.volume);
    if (this.info.list && cur().music.loop) try { this.player.setLoop(true); } catch (e) {}
    if (this.want) this.player.playVideo();
  },
  onState(s) {
    if (s === 1) { this.playing = true; this.err = ''; clearTimeout(this.timer); try { const d = this.player.getVideoData(); if (d && d.title) this.title = d.title.slice(0, 80); } catch (e) {} }
    else if (s === 2 || s === 0 || s === 5) this.playing = false;
    this.paint();
  },
  fail(msg, silent) {
    clearTimeout(this.timer); this.err = msg; this.want = false; this.playing = false; this.paint(); if (!silent) toast(msg);
  },
  teardown() {
    clearTimeout(this.timer); this.arm(false); this.gen++;
    if (this.player) { try { this.player.destroy(); } catch (e) {} }
    if (this.host) this.host.remove(); if (this.audio) { this.audio.pause(); this.audio.src = ''; }
    this.player = this.host = this.audio = null; this.ready = this.playing = this.want = this.userPaused = false; this.err = ''; this.title = '';
  },
  setVolume(v) { if (this.audio) this.audio.volume = v / 100; if (this.player && this.ready) try { this.player.setVolume(v); } catch (e) {} },

  play() {
    this.want = true; this.err = ''; this.userPaused = false; this.arm(false);
    if (this.audio) this.audio.play().catch(() => this.fail('Your browser blocked the audio. Tap the play button again.'));
    else {
      if (!this.player && this.info && !this.host) this.mount(cur().music);
      if (this.ready) this.player.playVideo();
      clearTimeout(this.timer);
      this.timer = setTimeout(() => { if (!this.playing) this.fail(location.protocol === 'file:' ? FILE_MSG : 'Playback did not start. The browser may be blocking autoplay or the embedded player.'); }, 10000);
    }
    this.paint();
  },
  pause() {
    this.want = false; this.userPaused = true; clearTimeout(this.timer);
    if (this.audio) this.audio.pause(); else if (this.player && this.ready) try { this.player.pauseVideo(); } catch (e) {}
    this.playing = false; this.paint();
  },
  toggle() { if (this.playing || (this.want && !this.err)) this.pause(); else this.play(); },
  arm(on) {
    if (this.armFn) { ['pointerdown', 'keydown'].forEach(t => document.removeEventListener(t, this.armFn, true)); this.armFn = null; }
    if (!on || this.playing || this.want || this.userPaused || !this.info) return;
    this.armFn = e => { if (e.target.closest && e.target.closest('#music')) return; this.arm(false); this.play(); };
    ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, this.armFn, true));
  },
  paint() {
    const tile = $('#music'), p = cur(); if (!p) return;
    tile.classList.toggle('playing', this.playing); tile.classList.toggle('err', !!this.err);
    tile.title = this.err || '';
    $('#musicBtn').setAttribute('aria-label', this.playing ? 'Pause music' : 'Play music');
    $('#musicTitle').textContent = this.title || 'Music';
    $('#musicSub').textContent = this.err ? 'Could not play. Tap to retry' : this.playing ? 'Playing' : this.want ? 'Loading…' : (this.armFn ? 'Starts on first tap' : 'Tap to play');
  },
};
$('#musicBtn').addEventListener('click', () => Music.toggle());
