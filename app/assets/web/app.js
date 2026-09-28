// CartoonHub front end. Everything it shows comes from /api/search, answered by
// a headless browser: local_server.dart + HeadlessBrowser.kt on Android,
// desktop/backend.js + headless.js in the Windows app.

// The Windows app serves this page on app:// and gets the desktop layout
// (sidebar + top bar); ?desktop forces it in a normal browser.
const DESKTOP = location.protocol === 'app:' || new URLSearchParams(location.search).has('desktop');

const $screen = document.getElementById('screen');
const $tabbar = document.getElementById('tabbar');
const $sheet = document.getElementById('sheet');
const $toast = document.getElementById('toast');
const $app = document.getElementById('app');

/* ------------------------------------------------------------------ icons */
const P = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  list: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 2 2s-1-3 1-7z" fill="#ff8a1e" stroke="none"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
  tablet: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 18h2"/>',
  phone: '<rect x="8" y="3" width="8" height="18" rx="2"/>',
  game: '<path d="M6 9h12a3 3 0 0 1 3 3l-1 5a2 2 0 0 1-3.5 1L15 16H9l-1.5 2A2 2 0 0 1 4 17l-1-5a3 3 0 0 1 3-3z"/><path d="M8 11v3M6.5 12.5h3M15 12h.01M17 13.5h.01"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 13a8 8 0 0 0 14 4.5l2-2.5"/><path d="M4 4v5h5M20 20v-5h-5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  dots: '<circle cx="12" cy="5" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.7" fill="currentColor" stroke="none"/>',
  star: '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" stroke="none"/>',
};
const icon = (n, s = 22, extra = '') => `<svg class="i" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[n]}</svg>`;
const verified = `<svg class="verified" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#3f8cff"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
// Each copy gets its own gradient id: a shared one breaks when the copy defining it is hidden.
let logoSeq = 0;
const logoMark = (s = 30, id = `lg${++logoSeq}`) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff9f1c"/></linearGradient></defs><rect x="2" y="6" width="28" height="22" rx="6" fill="url(#${id})"/><path d="M11 2l5 4 5-4" stroke="#ffd23f" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M13 12v10l8-5z" fill="#1a1400"/></svg>`;
const logo = () => `<div class="logo">${logoMark()}<span>Cartoon<b>Hub</b></span></div>`;

/* ------------------------------------------------------------------ helpers */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('ch.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ch.' + k, JSON.stringify(v)); } catch {} },
};
function fmtDur(s) {
  if (!s && s !== 0) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  const u = [[31536000, 'year'], [2592000, 'month'], [604800, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']];
  for (const [n, l] of u) if (s >= n) { const v = Math.floor(s / n); return `${v} ${l}${v > 1 ? 's' : ''} ago`; }
  return 'just now';
}
const fullDate = iso => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
function toast(msg) {
  $toast.textContent = msg; $toast.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => ($toast.hidden = true), 2200);
}
const img = (src, alt = '') => src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" onerror="this.style.visibility='hidden'">` : '';

/* ------------------------------------------------------------------ data */
const videos = new Map();      // id -> video
const pending = new Map();     // key -> promise
let lastResult = null;         // for the inspector
let upNext = [];               // list the current video was opened from

const familyMode = () => ['all', '7'].includes(store.get('rating', 'all'));

function api(q, pages = store.get('pages', 2)) {
  const key = `${q}|${pages}|${familyMode()}`;
  if (!pending.has(key)) {
    const p = fetch(`/api/search?q=${encodeURIComponent(q)}&pages=${pages}&family=${familyMode() ? 1 : 0}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.detail || j.error); return j; })
      .then(j => { j.videos.forEach(v => videos.set(v.id, v)); lastResult = j; return j; })
      .catch(e => { pending.delete(key); throw e; });
    pending.set(key, p);
  }
  return pending.get(key);
}
async function getVideo(id) {
  if (videos.has(id)) return videos.get(id);
  const saved = [...store.get('mylist', []), ...store.get('history', []).map(h => h.v)].find(v => v.id === id);
  if (saved) return saved;
  const r = await fetch(`/api/video/${id}`);
  if (r.ok) { const v = await r.json(); videos.set(id, v); return v; }
  return null;
}

const inList = id => store.get('mylist', []).some(v => v.id === id);
function toggleList(v) {
  let l = store.get('mylist', []);
  if (l.some(x => x.id === v.id)) { l = l.filter(x => x.id !== v.id); toast('Removed from My List'); }
  else { l.unshift({ ...v, addedAt: Date.now() }); toast('Added to My List'); }
  store.set('mylist', l);
}
// History entries are { v, at, t }: t is the playback position in seconds.
function addHistory(v) {
  const all = store.get('history', []);
  const old = all.find(x => x.v.id === v.id);
  store.set('history', [{ ...old, v, at: Date.now() }, ...all.filter(x => x.v.id !== v.id)].slice(0, 60));
}
function saveProgress(id, t) {
  const all = store.get('history', []);
  const h = all.find(x => x.v.id === id);
  if (h) { h.t = Math.floor(t); store.set('history', all); }
}

/* ------------------------------------------------------------------ components */
const skRow = (n = 4, cls = 'card') => `<div class="row">${Array.from({ length: n }, () => `<div class="${cls}"><div class="sk" style="aspect-ratio:16/10"></div><div class="sk sk-line"></div><div class="sk sk-line" style="width:60%"></div></div>`).join('')}</div>`;
// With a history entry h (Continue Watching), the card resumes playback and shows progress.
const card = (v, cls = 'card', h) => `<a class="${cls}" href="#/${h ? 'play' : 'video'}/${v.id}" data-id="${v.id}"><div class="thumb">${img(v.thumbnail, v.title)}<span class="dur">${fmtDur(v.duration)}</span>${h && v.duration ? `<span class="prog"><i style="width:${Math.min(100, (h.t || 0) / v.duration * 100)}%"></i></span>` : ''}</div><h4>${esc(v.title)}</h4><small>${esc(v.channel.name)} • ${ago(v.createdAt)}</small></a>`;
const gcard = v => `<a class="gcard" href="#/video/${v.id}" data-id="${v.id}"><div class="thumb">${img(v.thumbnail, v.title)}<div class="over">${esc(v.title)}</div></div><small style="margin-top:5px">${esc(v.channel.name)}</small></a>`;
const lrow = (v, now) => `<a class="lrow ${now ? 'now' : ''}" href="#/video/${v.id}" data-id="${v.id}"><div class="thumb">${img(v.thumbnail, v.title)}<span class="dur">${fmtDur(v.duration)}</span></div><div class="body"><h4>${esc(v.title)}</h4><small>${esc(v.channel.name)}${v.channel.verified ? verified : ''}</small><small>${fullDate(v.createdAt)}</small></div></a>`;

// Desktop cards. With a history entry h, the card shows watch progress and resumes playback.
function pcard(v, h) {
  const t = Math.floor(h?.t || 0), d = v.duration || 0;
  return `<div class="pcard ${h ? '' : 'flat'}" data-id="${v.id}">
    <a class="thumb" href="#/${h ? 'play' : 'video'}/${v.id}">${img(v.thumbnail, v.title)}
      ${h ? `<span class="tag">${fmtDur(t)}${d ? ` / ${fmtDur(d)}` : ''}</span><span class="prog"><i style="width:${d ? Math.min(100, t / d * 100) : 0}%"></i></span>`
        : d ? `<span class="tag">${fmtDur(d)}</span>` : ''}
      <span class="play">${icon('play', 22)}</span></a>
    <div class="pc-b"><a href="#/video/${v.id}" title="${esc(v.title)}"><h4>${esc(v.title)}</h4></a><small>${esc(v.channel.name)} • ${ago(v.createdAt)}</small>
      <button class="kebab" data-menu="${v.id}" aria-label="More options">${icon('dots', 20)}</button></div></div>`;
}
const dgrid = (list, h) => `<div class="dgrid" data-list>${list.map(v => pcard(v, h?.(v))).join('')}</div>`;
const dsec = (title, ic, href) => `<div class="dsec"><h3><span class="si">${icon(ic, 30)}</span>${esc(title)}</h3>${href ? `<a href="${href}">See All ${icon('chev', 16)}</a>` : ''}</div>`;

// The ⋮ menu on desktop cards.
$screen.addEventListener('click', e => {
  const k = e.target.closest('[data-menu]');
  if (!k) return;
  e.preventDefault();
  const v = videos.get(k.dataset.menu);
  if (v) popMenu(k, v);
});
$screen.addEventListener('scroll', () => closeMenu(), { passive: true });
function popMenu(anchor, v) {
  closeMenu();
  const inHist = store.get('history', []).some(x => x.v.id === v.id);
  const items = [
    ['play', 'Play', () => go(`#/play/${v.id}`)],
    [inList(v.id) ? 'check' : 'plus', inList(v.id) ? 'Remove from My List' : 'Add to My List', () => toggleList(v)],
    ['share', 'Copy Dailymotion link', () => { navigator.clipboard?.writeText(v.url); toast('Dailymotion link copied'); }],
    ['ext', 'Open on Dailymotion', () => window.open(v.url, '_blank')],
    ...(inHist ? [['trash', 'Remove from history', () => { store.set('history', store.get('history', []).filter(x => x.v.id !== v.id)); route(); }]] : []),
  ];
  const m = document.createElement('div');
  m.className = 'pop'; m.id = 'pop';
  m.innerHTML = items.map(([i, l], n) => `<button data-n="${n}">${icon(i, 18)}${l}</button>`).join('');
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = `${Math.max(8, r.right - m.offsetWidth)}px`;
  m.style.top = `${r.bottom + 6 + m.offsetHeight > innerHeight ? r.top - m.offsetHeight - 6 : r.bottom + 6}px`;
  m.onclick = e => { const b = e.target.closest('button'); if (b) { closeMenu(); items[+b.dataset.n][2](); } };
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }));
}
function closeMenu() { document.getElementById('pop')?.remove(); }

// When a video is opened from a list, remember that list for "Up Next".
$screen.addEventListener('click', e => {
  const a = e.target.closest('[data-id]');
  if (!a) return;
  const scope = a.closest('[data-list]');
  if (scope) upNext = [...scope.querySelectorAll('[data-id]')].map(x => videos.get(x.dataset.id)).filter(Boolean);
});

function groupsHtml(groups, style = 'list') {
  return groups.map(g => `<div class="date-h">${esc(g.label)} <span>${g.items.length}</span></div>` +
    (DESKTOP ? dgrid(g.items) : style === 'grid'
      ? `<div class="grid2">${g.items.map(v => card(v, 'gcard')).join('')}</div>`
      : `<div class="list">${g.items.map(v => lrow(v)).join('')}</div>`)).join('');
}

const loadingSteps = q => `<div class="loading-box"><div class="spinner"></div>
  <div>Searching Dailymotion for <b style="color:#fff">“${esc(q)}”</b></div>
  <div class="steps" id="steps">
    <div class="on">① Opening dailymotion.com/search/${esc(encodeURIComponent(q))} in the headless browser</div>
    <div>② Listening to the Network tab for SEARCH_QUERY</div>
    <div>③ Replaying the request for more pages</div>
    <div>④ Sorting results by upload date</div>
  </div></div>`;
function animateSteps() {
  const el = document.getElementById('steps'); if (!el) return;
  let i = 0; const t = setInterval(() => { const s = el.children; if (!document.body.contains(el) || ++i >= s.length) return clearInterval(t); s[i].classList.add('on'); }, 1500);
}
const errorBox = (e, retry) => `<div class="empty">${icon('x')}<br>Couldn't reach Dailymotion.<br><small>${esc(e.message)}</small><br><br><button class="btn yellow" style="margin:auto;padding:0 22px" onclick="${retry}">Try again</button></div>`;

/* ------------------------------------------------------------------ tab bar */
const TABS = [['home', 'Home', 'home'], ['explore', 'Explore', 'explore'], ['mylist', 'My List', 'list'], ['downloads', 'Downloads', 'download'], ['profile', 'Profile', 'user']];
function setTabs(active) {
  if (DESKTOP) return; // the sidebar is highlighted by route()
  const show = !!active;
  $tabbar.hidden = !show; $app.classList.toggle('has-tabs', show);
  if (show) $tabbar.innerHTML = TABS.map(([k, l, i]) => `<a href="#/${k}" class="${k === active ? 'on' : ''}">${icon(i, 22, k === active && i !== 'explore' ? 'fill="currentColor"' : '')}<span>${l}</span></a>`).join('');
}

/* ------------------------------------------------------------------ desktop shell */
const NAV = [['home', 'Home', 'home'], ['explore', 'Explore', 'explore'], ['mylist', 'My List', 'list'], ['downloads', 'Downloads', 'download'], ['settings', 'Settings', 'gear']];
if (DESKTOP) {
  document.documentElement.classList.add('desktop');
  $app.insertAdjacentHTML('afterbegin', `
    <aside id="side">${logo()}
      <nav>${NAV.map(([k, l, i]) => `<a href="#/${k}" data-nav="${k}">${icon(i, 26)}<span>${l}</span></a>`).join('')}</nav>
      <div class="tagline">Great Cartoons.<br>Anytime. Anywhere.<svg viewBox="0 0 130 16"><path d="M3 13C40 4 90 2 127 5"/></svg></div>
    </aside>
    <header id="top">
      <form class="top-search" id="ts">${icon('search', 22)}<input id="tq" type="search" placeholder="Search cartoons, series, movies..." autocomplete="off"></form>
      <button class="icon-btn" onclick="toast('No new notifications')" aria-label="Notifications">${icon('bell', 26)}</button>
      <a href="#/profile" class="me" aria-label="Profile"><span class="avatar">${icon('user', 22)}</span>${icon('down', 18)}</a>
    </header>`);
  document.getElementById('ts').onsubmit = e => {
    e.preventDefault();
    const q = document.getElementById('tq').value.trim();
    if (q) go(`#/explore?q=${encodeURIComponent(q)}`);
  };
}

/* ================================================================== SCREENS */

function splash() {
  setTabs(null);
  $app.classList.add('bare'); // desktop: no sidebar/top bar
  $screen.innerHTML = `<div class="splash">${logo()}<div class="tag">Endless cartoons. Non-stop fun.</div></div>`;
  api('cartoon').catch(() => {}); // warm the headless browser while the splash shows
  setTimeout(() => go(store.get('onboarded', false) ? '#/home' : '#/onboarding', true), 1700);
}

function onboarding() {
  setTabs(null);
  $app.classList.add('bare');
  const S = [
    { art: 1, fallback: `<div class="glow-orb"></div>${logoMark(90)}`, title: 'Endless Cartoons.<br><span class="g">Non-Stop Fun.</span>', text: 'Your favorite cartoons, anime and kids shows — all in one place.', icon: null },
    { art: 2, fallback: `<div class="collage">${'<div></div>'.repeat(6)}</div>`, title: 'Huge Library', text: 'Discover thousands of cartoons, anime, movies and kids shows. Something for everyone.', icon: 'grid' },
    { art: 3, fallback: `<div class="glow-orb"></div><div class="device-art"><span>${icon('tv', 28)}</span><span>${icon('tablet', 28)}</span><span>${icon('phone', 28)}</span><span style="grid-column:2">${icon('game', 28)}</span></div>`, title: 'Watch Anywhere', text: 'On your phone, tablet, TV or any device. Continue where you left off, anytime.', icon: 'sync' },
    { art: 4, fallback: '', overlay: `<div class="genre-card"><h4>For You</h4><div class="genre-grid">${[['Action', '#ff5a5a'], ['Adventure', '#35d07f'], ['Comedy', '#9b6bff'], ['Anime', '#2fa9ff'], ['Kids', '#ffc81e'], ['Fantasy', '#ff5ad1']].map(([n, c]) => `<span><em style="background:${c}"></em>${n}</span>`).join('')}</div></div>`, title: 'Personalized for You', text: 'Get recommendations based on your interests and what you love to watch.', icon: 'user' },
    { art: 5, fallback: `<div class="glow-orb"></div>${icon('play', 90, 'style="color:#ffc81e;width:90px;height:90px"')}`, title: 'Ready to Watch?', text: "Let's get you started and begin your cartoon adventure!", icon: 'play' },
  ];
  const n = S.length;
  $screen.innerHTML = `<div class="ob" id="ob">${S.map((s, i) => `
    <section class="slide">
      <div class="art"><div class="fallback">${s.fallback}</div><img class="photo" src="assets/onboarding-${s.art}.jpg" alt="" onerror="this.remove()">${s.overlay ? `<div class="overlay">${s.overlay}</div>` : ''}</div>
      <div class="copy">
        ${i === 0 ? `<div style="margin-bottom:6px">${logo()}</div>` : `<div class="ob-icon">${icon(s.icon, 26)}</div>`}
        <h1>${s.title}</h1><p>${s.text}</p>
        <div class="ob-foot">
          ${i === n - 1 ? `<button class="cta" data-done>Get Started ${icon('arrow')}</button>` : `
            <button class="skip" data-skip>${i === 0 ? '' : 'Skip'}</button>
            <div class="dots">${S.slice(0, -1).map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
            <button class="next" data-next="${i + 1}" aria-label="Next">${icon('arrow')}</button>`}
        </div>
      </div>
    </section>`).join('')}</div>`;
  const ob = document.getElementById('ob');
  const to = i => ob.scrollTo({ left: i * ob.clientWidth, behavior: 'smooth' });
  ob.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.next) to(+b.dataset.next);
    if ('skip' in b.dataset) to(n - 1);
    if ('done' in b.dataset) { store.set('onboarded', true); go('#/home'); }
  };
  // Fill the "Huge Library" collage with real thumbnails once the warm-up search lands.
  api('cartoon').then(r => {
    const tiles = ob.querySelectorAll('.collage div');
    r.videos.slice(0, tiles.length).forEach((v, i) => (tiles[i].style.backgroundImage = `url("${v.thumbnail}")`));
  }).catch(() => {});
}

const HOME_ROWS = [
  { title: 'New Releases', q: 'cartoon', icon: 'flame' },
  { title: 'Popular This Week', q: 'kids cartoon', icon: 'star' },
  { title: 'Anime Picks', q: 'anime episode', icon: 'sparkle' },
  { title: 'Tom and Jerry', q: 'tom and jerry', icon: 'tv' },
  { title: 'SpongeBob', q: 'spongebob', icon: 'tv' },
];

function home() {
  setTabs('home');
  if (DESKTOP) return homeDesktop();
  const hist = store.get('history', []);
  $screen.innerHTML = `
    <div class="topbar">${logo()}<div class="actions"><button onclick="toast('No new notifications')">${icon('bell')}</button><a href="#/profile" class="avatar">${icon('user', 20)}</a></div></div>
    <div class="hero" id="hero"><div class="hero-track"><div class="hero-card sk"></div></div></div>
    ${hist.length ? `<div class="section-h"><h3>Continue Watching</h3><a href="#/history">See All ${icon('chev', 14)}</a></div>
      <div class="row" data-list>${hist.slice(0, 10).map(h => card(h.v, 'card', h)).join('')}</div>` : ''}
    ${HOME_ROWS.map((r, i) => `<div class="section-h"><h3>${esc(r.title)}</h3><a href="#/explore?q=${encodeURIComponent(r.q)}">See All ${icon('chev', 14)}</a></div><div id="row${i}">${skRow()}</div>`).join('')}
    <div class="sp"></div>`;
  hist.forEach(h => videos.set(h.v.id, h.v));

  api(HOME_ROWS[0].q).then(r => renderHero(r.videos.slice(0, 5))).catch(() => (document.getElementById('hero').innerHTML = ''));
  HOME_ROWS.forEach((row, i) => api(row.q).then(r => {
    const el = document.getElementById('row' + i); if (!el) return;
    el.innerHTML = `<div class="row" data-list>${r.videos.slice(i === 0 ? 5 : 0, (i === 0 ? 5 : 0) + 12).map(v => card(v)).join('')}</div>`;
  }).catch(() => { const el = document.getElementById('row' + i); if (el) el.innerHTML = `<p class="pad muted" style="font-size:13px">Couldn't load this row.</p>`; }));
}

function renderHero(list) {
  const el = document.getElementById('hero'); if (!el || !list.length) return;
  el.innerHTML = `<div class="hero-track" id="ht">${list.map((v, i) => `
    <div class="hero-card">${img(v.thumbnail, v.title)}
      <div class="hero-info"><span class="badge">${i === 0 ? 'Newest' : 'New'}</span><h2>${esc(v.title)}</h2>
        <div class="meta">${esc(v.channel.name)} • ${ago(v.createdAt)} • ${fmtDur(v.duration)}</div>
        <div class="hero-btns"><a class="btn white" href="#/play/${v.id}">${icon('play', 18)} Play Now</a><a class="btn ghost" href="#/video/${v.id}">More Info</a></div>
      </div></div>`).join('')}</div>
    <div class="dots" id="hd">${list.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
  upNext = list;
  const ht = document.getElementById('ht'), dots = document.getElementById('hd').children;
  let idx = 0;
  ht.onscroll = () => { idx = Math.round(ht.scrollLeft / ht.clientWidth); [...dots].forEach((d, i) => d.classList.toggle('on', i === idx)); };
  clearInterval(renderHero.t);
  renderHero.t = setInterval(() => { if (!document.body.contains(ht)) return clearInterval(renderHero.t); ht.scrollTo({ left: ((idx + 1) % list.length) * ht.clientWidth, behavior: 'smooth' }); }, 5000);
}

function homeDesktop() {
  const hist = store.get('history', []);
  hist.forEach(h => videos.set(h.v.id, h.v));
  // "Popular This Week" first, then the rest; New Releases skips the 5 videos in the hero.
  const rows = [HOME_ROWS[1], HOME_ROWS[0], ...HOME_ROWS.slice(2)];
  $screen.innerHTML = `
    <div class="dhero" id="hero"><div class="sk"></div></div>
    ${hist.length ? dsec('Continue Watching', 'clock', '#/history') + `<div class="drow cw" data-list>${hist.slice(0, 4).map(h => pcard(h.v, h)).join('')}</div>` : ''}
    ${rows.map((r, i) => dsec(r.title, r.icon, `#/explore?q=${encodeURIComponent(r.q)}`) +
      `<div class="drow" id="drow${i}">${Array.from({ length: 5 }, () => '<div><div class="sk" style="aspect-ratio:16/9"></div><div class="sk sk-line"></div></div>').join('')}</div>`).join('')}
    <div class="sp"></div>`;

  api(HOME_ROWS[0].q).then(r => renderDeskHero(r.videos.slice(0, 5))).catch(() => document.getElementById('hero')?.remove());
  rows.forEach((row, i) => api(row.q).then(r => {
    const el = document.getElementById('drow' + i); if (!el) return;
    const skip = row === HOME_ROWS[0] ? 5 : 0;
    el.dataset.list = '';
    el.innerHTML = r.videos.slice(skip, skip + 5).map(v => pcard(v)).join('');
  }).catch(() => { const el = document.getElementById('drow' + i); if (el) el.outerHTML = `<p class="muted" style="font-size:14px">Couldn't load this row.</p>`; }));
}

function renderDeskHero(list) {
  const el = document.getElementById('hero'); if (!el || !list.length) return;
  upNext = list;
  const mlBtn = v => `${icon(inList(v.id) ? 'check' : 'plus', 22)} My List`;
  el.innerHTML = list.map((v, i) => `
    <div class="hs ${i ? '' : 'on'}">${img(v.thumbnail, v.title)}
      <div class="info"><span class="badge">${i === 0 ? 'Newest' : 'New'}</span><h2>${esc(v.title)}</h2>
        <p>From ${esc(v.channel.name)}${v.channel.verified ? verified : ''}, uploaded ${ago(v.createdAt)}.</p>
        <div class="meta"><span>${fmtDur(v.duration)}</span><span>${fullDate(v.createdAt)}</span><span>Dailymotion</span></div>
        <div class="btns"><a class="btn yellow" href="#/play/${v.id}">${icon('play', 20)} Play Now</a><button class="btn outline" data-ml="${v.id}">${mlBtn(v)}</button></div>
      </div></div>`).join('') +
    `<div class="dots">${list.map((_, i) => `<i data-i="${i}" class="${i ? '' : 'on'}"></i>`).join('')}</div>
    <div class="arrows"><button data-step="-1" aria-label="Previous">${icon('back', 20)}</button><button data-step="1" aria-label="Next">${icon('chev', 20)}</button></div>`;
  let idx = 0;
  const show = i => {
    idx = (i + list.length) % list.length;
    el.querySelectorAll('.hs').forEach((s, j) => s.classList.toggle('on', j === idx));
    el.querySelectorAll('.dots i').forEach((d, j) => d.classList.toggle('on', j === idx));
  };
  const stop = () => clearInterval(renderHero.t);
  const start = () => { stop(); renderHero.t = setInterval(() => document.body.contains(el) ? show(idx + 1) : stop(), 6000); };
  el.onclick = e => {
    const t = e.target.closest('[data-step],[data-i],[data-ml]'); if (!t) return;
    if (t.dataset.ml) { const v = list.find(x => x.id === t.dataset.ml); toggleList(v); t.innerHTML = mlBtn(v); return; }
    show(t.dataset.step ? idx + +t.dataset.step : +t.dataset.i);
  };
  el.onmouseenter = stop; // hold the slide while the pointer is on it
  el.onmouseleave = start;
  start();
}

const CHIPS = [['All', 'cartoon'], ['Action', 'action cartoon'], ['Comedy', 'funny cartoon'], ['Adventure', 'adventure cartoon'], ['Fantasy', 'fantasy animation'], ['Anime', 'anime'], ['Kids', 'kids cartoon'], ['Movies', 'animated movie']];

function explore(params) {
  setTabs('explore');
  const q = params.get('q') || '';
  const chip = params.get('chip') || (q ? '' : 'All');
  $screen.innerHTML = `
    <div class="title-bar"><h2>Explore</h2></div>
    <form class="searchbox" id="sf">${icon('search', 20)}<input id="sq" type="search" placeholder="Search cartoons, anime, movies..." value="${esc(q)}" autocomplete="off" enterkeyhint="search">${q ? `<a href="#/explore">${icon('x', 18)}</a>` : ''}</form>
    <div class="chips">${CHIPS.map(([l]) => `<a class="chip ${l === chip ? 'on' : ''}" href="#/explore?chip=${l}">${l}</a>`).join('')}</div>
    <div id="res"></div>`;
  const sf = document.getElementById('sf');
  sf.onsubmit = e => { e.preventDefault(); const v = document.getElementById('sq').value.trim(); if (v) go(`#/explore?q=${encodeURIComponent(v)}`); };

  const res = document.getElementById('res');
  if (q) {
    const recent = [q, ...store.get('recent', []).filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    store.set('recent', recent);
    return runSearch(res, q, 'list');
  }
  const cq = CHIPS.find(c => c[0] === chip)?.[1] || 'cartoon';
  const recent = store.get('recent', []);
  res.innerHTML = (chip === 'All' && recent.length ? `<div class="section-h"><h3>Recent searches</h3><button onclick="localStorage.removeItem('ch.recent');location.reload()">Clear</button></div>
      <div class="recent">${recent.map(r => `<a href="#/explore?q=${encodeURIComponent(r)}">${icon('clock', 18)}<span style="flex:1">${esc(r)}</span>${icon('chev', 16)}</a>`).join('')}</div>` : '') +
    `<div class="section-h"><h3>${icon('flame', 20)} ${chip === 'All' ? 'Trending Now' : esc(chip)}</h3></div><div id="cres"></div>`;
  runSearch(document.getElementById('cres'), cq, 'grid');
}

function runSearch(el, q, style) {
  el.innerHTML = loadingSteps(q); animateSteps();
  api(q).then(r => {
    if (!document.body.contains(el)) return;
    if (!r.total) { el.innerHTML = `<div class="empty">${icon('search')}<br>No videos found for “${esc(q)}”.</div>`; return; }
    el.innerHTML = `<div class="result-meta"><div><b>${r.total} videos</b> · newest first<br>${(r.tookMs / 1000).toFixed(1)}s via headless browser${r.cached ? ' (cached)' : ''}</div><button id="insp">${icon('code', 16)} How?</button></div>
      <div data-list>${groupsHtml(r.groups, style)}</div><div class="sp"></div>`;
    document.getElementById('insp').onclick = () => inspector(r.trace);
  }).catch(e => { if (document.body.contains(el)) el.innerHTML = errorBox(e, 'location.reload()'); });
}

async function details(id) {
  setTabs(null);
  const v = await getVideo(id);
  if (!v) { $screen.innerHTML = `<div class="title-bar"><button class="icon-btn" onclick="history.back()">${icon('back')}</button></div><div class="empty">This video isn't loaded anymore.<br>Search for it again from Explore.</div>`; return; }
  $screen.innerHTML = `
    <div class="d-top"><div class="d-hero">${img(v.thumbnail, v.title)}<div class="nav"><button class="icon-btn glass" onclick="history.back()">${icon('back')}</button><button class="icon-btn glass" id="share">${icon('share', 20)}</button></div></div>
    <div class="d-body">
      <h1>${esc(v.title)}</h1>
      <div class="d-meta"><span>${ago(v.createdAt)}</span><span>${fmtDur(v.duration)}</span><span>Dailymotion</span></div>
      <div class="channel">${v.channel.avatar ? img(v.channel.avatar) : '<div class="ph"></div>'}<div><b style="font-weight:600">${esc(v.channel.name)}</b>${v.channel.verified ? verified : ''}<br><small class="muted">@${esc(v.channel.handle || '')}</small></div></div>
      <div class="d-btns"><a class="btn yellow" href="#/play/${v.id}">${icon('play', 18)} Play</a><button class="btn ghost" id="ml">${icon(inList(v.id) ? 'check' : 'plus', 18)} My List</button></div>
    </div></div>
    <div class="tabs" id="dt"><button class="on" data-t="more">More Like This</button><button data-t="info">Details</button></div>
    <div id="dtab"></div><div class="sp"></div>`;
  document.getElementById('ml').onclick = e => { toggleList(v); e.currentTarget.innerHTML = `${icon(inList(v.id) ? 'check' : 'plus', 18)} My List`; };
  document.getElementById('share').onclick = () => { navigator.clipboard?.writeText(v.url); toast('Dailymotion link copied'); };
  const tab = document.getElementById('dtab');
  const more = () => {
    const q = moreQuery(v.title);
    tab.innerHTML = skRow(3);
    api(q, 1).then(r => {
      const list = r.videos.filter(x => x.id !== v.id).slice(0, 20);
      tab.innerHTML = !list.length ? `<div class="empty">Nothing similar found.</div>`
        : DESKTOP ? dgrid(list) : `<div class="list" data-list>${list.map(x => lrow(x)).join('')}</div>`;
    }).catch(e => (tab.innerHTML = errorBox(e, 'location.reload()')));
  };
  const info = () => tab.innerHTML = `<div class="kv">
    <div><span>Published</span><span>${fullDate(v.createdAt)}</span></div>
    <div><span>Duration</span><span>${fmtDur(v.duration)}</span></div>
    <div><span>Channel</span><span>${esc(v.channel.name)}</span></div>
    <div><span>Video ID</span><span>${esc(v.id)}</span></div>
    <div><span>Source</span><span><a href="${esc(v.url)}" target="_blank" rel="noopener" style="color:var(--yellow)">Open on Dailymotion</a></span></div></div>`;
  document.getElementById('dt').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
    b.dataset.t === 'more' ? more() : info();
  };
  more();
}
function moreQuery(title) {
  const stop = new Set(['the', 'a', 'an', 'and', 'of', 'in', 'to', 'for', 'full', 'episode', 'ep', 'hd', 'new', 'with', 'movie', 'cartoon', 'english', 'engsub']);
  const w = title.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter(x => x.length > 1 && !stop.has(x) && !/^\d+$/.test(x));
  return w.slice(0, 2).join(' ') || title.slice(0, 20);
}

async function player(id) {
  setTabs(null);
  const v = await getVideo(id);
  if (!v) return details(id);
  addHistory(v);
  const list = upNext.length ? upNext : [v];
  $screen.innerHTML = `<div class="pl"><div class="pl-main">
    <div class="player">
      <div class="bar"><button class="icon-btn" onclick="history.back()">${icon('back')}</button><a class="icon-btn" href="${esc(v.url)}" target="_blank" rel="noopener" title="Open on Dailymotion">${icon('ext', 20)}</a></div>
      <div class="frame"><video id="vid" controls autoplay playsinline poster="${esc(v.thumbnail || '')}"></video></div>
    </div>
    <div class="np">${img(v.thumbnail)}<div style="min-width:0"><h4>${esc(v.title)}</h4><small>${esc(v.channel.name)} • ${fullDate(v.createdAt)}</small></div></div>
    </div><div class="pl-side">
    <div class="tabs"><button class="on">Up Next</button></div>
    <div class="list" data-list>${list.slice(0, 30).map(x => lrow(x, x.id === v.id).replace(`href="#/video/${x.id}"`, `href="#/play/${x.id}"`)).join('')}</div>
    </div></div>
    <div class="sp"></div>`;
  playStream(v, document.getElementById('vid'));
}

// Plays the video's HLS stream through the local /api/stream proxy (desktop/stream.js on
// desktop, local_server.dart on the phone). If that fails, swaps in Dailymotion's
// embed player instead.
let hls = null;
let playing = null; // { id, video } of the stream on screen
function stopStream() {
  // Save the exact spot on the way out (the timeupdate saves are up to 5s behind).
  if (playing?.video.isConnected && playing.video.currentTime >= 5) saveProgress(playing.id, playing.video.currentTime);
  playing = null;
  hls?.destroy(); hls = null;
}
function playStream(v, video) {
  const src = `/api/stream/${encodeURIComponent(v.id)}`;
  const fallback = () => {
    stopStream();
    if (document.body.contains(video)) video.outerHTML = `<iframe src="${esc(v.embed)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${esc(v.title)}"></iframe>`;
  };
  // Resume where the viewer left off (unless it was nearly finished), and keep saving the position.
  const h = store.get('history', []).find(x => x.v.id === v.id);
  const resume = h?.t > 5 && h.t < (v.duration || Infinity) - 15 ? h.t : -1;
  playing = { id: v.id, video };
  let saved = 0;
  video.addEventListener('timeupdate', () => {
    // Leaving the screen detaches the stream and fires one last update at 0:00; ignore it.
    if (!video.isConnected || video.currentTime < 5 || Math.abs(video.currentTime - saved) < 5) return;
    saved = video.currentTime;
    saveProgress(v.id, saved);
  });
  if (window.Hls?.isSupported()) {
    // startPosition makes hls.js load from there, rather than seeking after the start loaded.
    hls = new Hls({ startPosition: resume });
    hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) fallback(); });
    hls.loadSource(src);
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    if (resume > 0) video.addEventListener('loadedmetadata', () => (video.currentTime = resume), { once: true });
    video.onerror = fallback;
    video.src = src;
  } else fallback();
}

function mylist(params) {
  setTabs('mylist');
  const tab = params.get('tab') || 'episodes';
  const all = store.get('mylist', []);
  all.forEach(v => videos.set(v.id, v));
  const isMovie = v => (v.duration || 0) >= 40 * 60;
  const shown = all.filter(v => (tab === 'movies') === isMovie(v));
  $screen.innerHTML = `
    <div class="title-bar"><h2>My List</h2></div>
    <div class="seg"><a href="#/mylist?tab=episodes"><button class="${tab === 'episodes' ? 'on' : ''}" style="width:100%">Episodes</button></a><a href="#/mylist?tab=movies"><button class="${tab === 'movies' ? 'on' : ''}" style="width:100%">Movies</button></a></div>
    ${shown.length ? (DESKTOP ? dgrid(shown) : `<div class="grid3" data-list>${shown.map(gcard).join('')}</div>`) :
      `<div class="empty">${icon('list')}<br>Nothing here yet.<br>${DESKTOP ? 'Click' : 'Tap'} <b>+ My List</b> on any video${tab === 'movies' ? ' longer than 40 minutes' : ''}.</div>`}
    ${all.length && !DESKTOP ? `<div class="section-h"><h3>Recently Added</h3></div><div class="row" data-list>${all.slice(0, 10).map(v => card(v)).join('')}</div>` : ''}
    <div class="sp"></div>`;
}

function downloads(params) {
  setTabs('downloads');
  const tab = params.get('tab') || 'progress';
  $screen.innerHTML = `
    <div class="title-bar"><h2>Downloads</h2></div>
    <div class="seg"><a href="#/downloads?tab=progress"><button class="${tab === 'progress' ? 'on' : ''}" style="width:100%">In Progress</button></a><a href="#/downloads?tab=done"><button class="${tab === 'done' ? 'on' : ''}" style="width:100%">Downloaded</button></a></div>
    <div class="empty">${icon('download')}<br><b style="color:#fff">No downloads</b><br>Videos stream straight from Dailymotion, so offline downloads are switched off.</div>
    <div class="storage">0 GB used<div class="track"><i></i></div></div>`;
}

function profile() {
  setTabs('profile');
  const n = k => store.get(k, []).length;
  $screen.innerHTML = `
    <div class="prof"><div class="avatar">${icon('user', 34)}</div><div><h2>Annan</h2><small>Kids • Personal</small></div><a class="icon-btn" href="#/settings">${icon('gear')}</a></div>
    <div class="menu">
      <a href="#/mylist">${icon('list')}<span class="t">My List<small>${n('mylist')} items</small></span>${icon('chev', 18)}</a>
      <a href="#/downloads">${icon('download')}<span class="t">Downloads<small>0 items</small></span>${icon('chev', 18)}</a>
      <a href="#/history">${icon('clock')}<span class="t">Watch History<small>${n('history')} items</small></span>${icon('chev', 18)}</a>
    </div>
    <div class="menu">
      <button id="pcBtn">${icon('shield')}<span class="t">Parental Controls<small>Content restrictions & PIN</small></span>${icon('chev', 18)}</button>
      <a href="#/how">${icon('help')}<span class="t">How it works<small>The headless browser, explained</small></span>${icon('chev', 18)}</a>
      <a href="#/settings">${icon('gear')}<span class="t">Settings<small>Search depth, reset data</small></span>${icon('chev', 18)}</a>
    </div>
    <div class="promo">${icon('code', 30, 'style="color:#ffc81e;width:30px;height:30px"')}<div style="flex:1"><h4>Under the hood</h4><p>See the network requests from your last search.</p></div><button class="btn yellow" id="uth">Inspect</button></div>`;
  document.getElementById('uth').onclick = async () => inspector(await (await fetch('/api/trace')).json());
  document.getElementById('pcBtn').onclick = () => withPin(() => go('#/parental'));
}

function historyScreen() {
  setTabs(null);
  const h = store.get('history', []);
  h.forEach(x => videos.set(x.v.id, x.v));
  $screen.innerHTML = `<div class="title-bar"><button class="icon-btn" onclick="history.back()">${icon('back')}</button><h2>Watch History</h2>
      ${h.length ? `<button class="icon-btn" style="margin-left:auto" id="clr">${icon('trash', 20)}</button>` : ''}</div>
    ${h.length ? (DESKTOP ? dgrid(h.map(x => x.v), v => h.find(x => x.v.id === v.id)) : `<div class="list" data-list>${h.map(x => lrow(x.v)).join('')}</div>`) : `<div class="empty">${icon('clock')}<br>You haven't watched anything yet.</div>`}<div class="sp"></div>`;
  const c = document.getElementById('clr'); if (c) c.onclick = () => { store.set('history', []); historyScreen(); toast('History cleared'); };
}

const RATINGS = [['all', 'All Ages', 'G', 'Family filter on'], ['7', '7+', '7', 'Family filter on'], ['13', '13+', '13', 'Family filter off'], ['16', '16+', '16', 'Family filter off']];
function parental() {
  setTabs(null);
  const r = store.get('rating', 'all'), pinOn = store.get('pinOn', false);
  $screen.innerHTML = `<div class="pc">
    <div class="title-bar"><button class="icon-btn" onclick="history.back()">${icon('back')}</button><h2>Parental Controls</h2></div>
    <h3>Content Rating</h3><p>Allow content suitable for:</p>
    ${RATINGS.map(([k, l, ic, sub]) => `<button class="rate ${k === r ? 'on' : ''}" data-r="${k}"><span class="ic">${ic}</span><span class="t">${l}<small>${sub}</small></span><span class="radio"></span></button>`).join('')}
    <div class="switch-row"><div><h3 style="margin:0;font-size:16px">PIN Protection</h3><small class="muted" style="font-size:12.5px">Require PIN to open Parental Controls</small></div><button class="switch ${pinOn ? 'on' : ''}" id="pinT" aria-label="PIN protection"></button></div>
    <div class="menu" style="margin-top:14px"><button id="chPin"><span class="t">Change PIN</span>${icon('chev', 18)}</button></div>
    <div class="info-card">${icon('shield', 34, 'style="color:#8fb1ff;width:34px;height:34px"')}<div><b>Keep your kids safe</b>“All Ages” and “7+” turn on Dailymotion's own family filter inside the headless browser, so its searches return family-safe results.</div></div></div>`;
  $screen.querySelectorAll('.rate').forEach(b => b.onclick = () => { store.set('rating', b.dataset.r); pending.clear(); parental(); toast('Content rating saved'); });
  document.getElementById('pinT').onclick = () => {
    if (store.get('pinOn', false)) { store.set('pinOn', false); parental(); }
    else pinPad('Create a 4-digit PIN', p => { store.set('pin', p); store.set('pinOn', true); parental(); toast('PIN protection on'); });
  };
  document.getElementById('chPin').onclick = () => pinPad('New 4-digit PIN', p => { store.set('pin', p); store.set('pinOn', true); parental(); toast('PIN updated'); });
}

function withPin(fn) {
  if (!store.get('pinOn', false)) return fn();
  pinPad('Enter your PIN', p => p === store.get('pin') ? (fn(), true) : false);
}
function pinPad(title, onDone) {
  let val = '';
  openSheet(`<h3 style="text-align:center">${title}</h3><div class="pin-dots" id="pd">${'<i></i>'.repeat(4)}</div><div class="pin-err" id="pe"></div>
    <div class="pin-pad" id="pp">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(k => k === '' ? '<span></span>' : `<button data-k="${k}">${k}</button>`).join('')}</div>`);
  document.getElementById('pp').onclick = e => {
    const k = e.target.closest('button')?.dataset.k; if (k == null) return;
    val = k === '⌫' ? val.slice(0, -1) : (val + k).slice(0, 4);
    [...document.getElementById('pd').children].forEach((d, i) => d.classList.toggle('on', i < val.length));
    if (val.length === 4) {
      const ok = onDone(val);
      if (ok === false) { document.getElementById('pe').textContent = 'Wrong PIN'; val = ''; setTimeout(() => [...document.getElementById('pd').children].forEach(d => d.classList.remove('on')), 150); }
      else closeSheet();
    }
  };
}

function settings() {
  setTabs(null);
  const pages = store.get('pages', 2);
  $screen.innerHTML = `
    <div class="title-bar"><button class="icon-btn" onclick="history.back()">${icon('back')}</button><h2>Settings</h2></div>
    <div class="pc"><h3>Search depth</h3><p>How many result pages (20 videos each) the headless browser collects per search. More pages = more results, slower search.</p></div>
    <div class="chips" style="margin-bottom:10px">${[1, 2, 3, 4, 5].map(n => `<button class="chip ${n === pages ? 'on' : ''}" data-p="${n}">${n} page${n > 1 ? 's' : ''}</button>`).join('')}</div>
    <div class="menu" style="margin-top:20px">
      <button id="rOb">${icon('sync')}<span class="t">Replay onboarding</span>${icon('chev', 18)}</button>
      <button id="rAll">${icon('trash')}<span class="t">Reset all app data<small>My List, history, searches, PIN</small></span>${icon('chev', 18)}</button>
    </div>`;
  $screen.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { store.set('pages', +b.dataset.p); pending.clear(); settings(); toast('Saved'); });
  document.getElementById('rOb').onclick = () => { store.set('onboarded', false); go('#/onboarding'); };
  document.getElementById('rAll').onclick = () => { if (confirm('Reset all CartoonHub data on this device?')) { Object.keys(localStorage).filter(k => k.startsWith('ch.')).forEach(k => localStorage.removeItem(k)); location.hash = '#/'; location.reload(); } };
}

function how() {
  setTabs(null);
  $screen.innerHTML = `
    <div class="title-bar"><button class="icon-btn" onclick="history.back()">${icon('back')}</button><h2>How it works</h2></div>
    <div class="pad" style="font-size:13.5px;color:#cbd3ee;line-height:1.6">
      <p>CartoonHub has no video database of its own. Every result comes from a <b style="color:#fff">headless Chromium browser</b> running hidden in the background on your device.</p>
      <ol class="flow">
        <li>You type <b style="color:#fff">Boonie Bears</b> and hit search.</li>
        <li>The app opens <code>dailymotion.com/search/Boonie%20Bears/videos</code> in the invisible browser.</li>
        <li>It listens to the browser's network traffic (like the DevTools Network tab) and catches the page's own <code>SEARCH_QUERY</code> call to <code>search.dailymotion.com/v1</code>.</li>
        <li>For page 2, 3… it replays that same request from inside the page, changing only the page number.</li>
        <li>Videos are pulled out of the JSON, de-duplicated, off-topic ones dropped, then sorted newest first and grouped by date.</li>
        <li>The app gets clean JSON and draws it with this UI. Playback streams the video's HLS feed through the app's own local proxy, falling back to Dailymotion's embed player.</li>
      </ol>
      <button class="btn yellow" style="width:100%" id="lt">${icon('code', 18)} Inspect last search</button>
    </div><div class="sp"></div>`;
  document.getElementById('lt').onclick = async () => inspector(await (await fetch('/api/trace')).json());
}

/* ------------------------------------------------------------------ sheet */
function openSheet(html) {
  $sheet.innerHTML = `<div class="panel"><div class="grab"></div>${html}</div>`;
  $sheet.hidden = false;
  $sheet.onclick = e => { if (e.target === $sheet) closeSheet(); };
}
function closeSheet() { $sheet.hidden = true; $sheet.innerHTML = ''; }

function inspector(t) {
  if (!t) return openSheet(`<h3>Under the hood</h3><p class="muted">No search has run yet. Try one in Explore.</p>`);
  openSheet(`<h3>Under the hood</h3>
    <p class="muted" style="font-size:12.5px;margin:0 0 12px">“${esc(t.query)}” · ${(t.tookMs / 1000).toFixed(1)}s · kept ${t.kept} of ${t.scanned} videos</p>
    <b style="font-size:13px">1. Page opened in the headless browser</b>
    <div class="code">${esc(t.source)}</div>
    <b style="font-size:13px">2. Request captured from the Network tab</b>
    <div class="code">POST ${esc(t.captured?.url)}
operationName: ${esc(t.captured?.operation)}
variables: ${esc(JSON.stringify(t.captured?.variables, null, 2))}</div>
    <b style="font-size:13px">3. Dailymotion XHR/fetch traffic (${t.requests.length})</b>
    <div style="margin-top:8px">${t.requests.map(r => `<div class="req ${r.operation === 'SEARCH_QUERY' ? 'hit' : ''}"><span class="m">${r.method}</span><span class="u" title="${esc(r.url)}">${r.operation ? `<b>${esc(r.operation)}</b> ` : ''}${esc(r.url.replace('https://', ''))}</span><span class="m">${r.status ?? ''}</span></div>`).join('')}</div>`);
}

/* ------------------------------------------------------------------ router */
function go(hash, replace) { replace ? location.replace(hash) : (location.hash = hash); }
function route() {
  closeSheet();
  closeMenu();
  stopStream();
  const [path, qs] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(qs || '');
  const [, name, arg] = (path || '/').split('/');
  $screen.scrollTop = 0;
  $screen.dataset.route = name || 'splash';
  if (DESKTOP) {
    $app.classList.remove('bare');
    document.querySelectorAll('#side [data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === name));
    document.getElementById('tq').value = name === 'explore' ? params.get('q') || '' : '';
  }
  switch (name) {
    case 'onboarding': return onboarding();
    case 'home': return home();
    case 'explore': return explore(params);
    case 'video': return details(arg);
    case 'play': return player(arg);
    case 'mylist': return mylist(params);
    case 'downloads': return downloads(params);
    case 'profile': return profile();
    case 'history': return historyScreen();
    case 'parental': return parental();
    case 'settings': return settings();
    case 'how': return how();
    default: return splash();
  }
}
window.toast = toast;
window.addEventListener('hashchange', route);
route();
