// Video playback: /api/stream/<xid> and /api/hls?u=<url> (same API as the
// Android app's local_server.dart).
//
// Dailymotion's CDN sends no CORS headers for this app, so the page can't fetch
// the HLS stream itself. The master playlist also needs Dailymotion's cookies
// and is refused to non-browser clients, so it is fetched from a hidden window
// sitting on www.dailymotion.com. Everything after that (variant playlists and
// segments) is fetched here. Every URI inside the playlists (absolute or
// relative) is rewritten to come back through /api/hls.

const { BrowserWindow, net } = require('electron');

const PARTITION = 'persist:dailymotion';
// Tiny page, only needed so fetches run with the www.dailymotion.com origin and cookies.
const ORIGIN_PAGE = 'https://www.dailymotion.com/robots.txt';
const PROXY_HOSTS = /(^|\.)(dailymotion\.com|dmcdn\.net)$/;
const M3U8 = 'application/vnd.apple.mpegurl';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let pagePromise = null;
function originPage() {
  pagePromise ??= (async () => {
    const w = new BrowserWindow({ show: false, webPreferences: { partition: PARTITION, backgroundThrottling: false, sandbox: true } });
    w.on('closed', () => { pagePromise = null; });
    await w.loadURL(ORIGIN_PAGE);
    return w;
  })();
  return pagePromise;
}

// Runs inside the dailymotion.com page.
const inPage = async xid => {
  const meta = await (await fetch(`/player/metadata/video/${encodeURIComponent(xid)}`, { credentials: 'include' })).json();
  const src = meta.qualities?.auto?.[0]?.url;
  if (!src) return { error: meta.error?.title || meta.error?.message || 'No HLS stream in player metadata' };
  const r = await fetch(src, { credentials: 'include' });
  if (!r.ok) return { error: `Dailymotion refused the stream (HTTP ${r.status})` };
  return { url: r.url, text: await r.text() };
};

async function fetchManifest(xid) {
  let w;
  try {
    w = await originPage();
  } catch (err) {
    pagePromise = null; // try opening the page again next time
    throw err;
  }
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out asking dailymotion.com for the stream')), 25000); });
  try {
    return await Promise.race([w.webContents.executeJavaScript(`(${inPage})(${JSON.stringify(xid)})`), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function rewritePlaylist(text, base) {
  const proxied = uri => { const u = new URL(uri, base); u.hash = ''; return `/api/hls?u=${encodeURIComponent(u)}`; };
  return text.split('\n').map(line => {
    const l = line.trim();
    if (!l) return line;
    if (!l.startsWith('#')) return proxied(l);
    return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxied(uri)}"`);
  }).join('\n');
}

const playlist = (text, base) =>
  new Response(rewritePlaylist(text, base), { headers: { 'content-type': M3U8, 'cache-control': 'no-cache' } });

// GET /api/stream/x9gxeto -> master playlist for that video
async function master(xid) {
  try {
    const m = await fetchManifest(xid);
    if (m.error) return json({ error: 'No stream for this video', detail: m.error }, 502);
    return playlist(m.text, m.url);
  } catch (err) {
    return json({ error: 'Could not load the stream', detail: String(err.message || err) }, 502);
  }
}

// GET /api/hls?u=<url> -> variant playlist (rewritten) or media segment (streamed)
async function proxy(u) {
  let url;
  try { url = new URL(u); } catch { return json({ error: 'Bad ?u=' }, 400); }
  if (url.protocol !== 'https:' || !PROXY_HOSTS.test(url.hostname)) return json({ error: 'Host not allowed' }, 403);
  const r = await net.fetch(url.href);
  if (!r.ok) return new Response(null, { status: r.status });
  const type = r.headers.get('content-type') || '';
  // net.fetch can leave r.url empty; relative URIs then resolve against the URL we asked for.
  if (/mpegurl/i.test(type) || url.pathname.endsWith('.m3u8')) return playlist(await r.text(), r.url || url.href);
  const headers = { 'content-type': type || 'video/mp2t' };
  const len = r.headers.get('content-length');
  if (len) headers['content-length'] = len;
  return new Response(r.body, { headers });
}

module.exports = { master, proxy };
