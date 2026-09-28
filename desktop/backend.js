// Answers every app://cartoonhub/ request: the /api/* routes the web UI calls
// (same API as the Android app's local_server.dart) and the UI files themselves.

const { app, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const headless = require('./headless');
const stream = require('./stream');

// In the installed app the UI is copied next to the exe (see "extraResources" in package.json).
const WEB = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'app', 'assets', 'web');
const CACHE_TTL = 15 * 60 * 1000;

const cache = new Map();   // key -> { at, data }
const videos = new Map();  // xid -> normalised video (for detail screens)
let lastTrace = null;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function handle(req) {
  const url = new URL(req.url);
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/search') return await search(url.searchParams);
    if (p.startsWith('/api/video/')) {
      const v = videos.get(p.slice('/api/video/'.length));
      return v ? json(v) : json({ error: 'Not in cache yet' }, 404);
    }
    if (p === '/api/trace') return json(lastTrace);
    if (p.startsWith('/api/stream/')) return await stream.master(p.slice('/api/stream/'.length));
    if (p === '/api/hls') return await stream.proxy(url.searchParams.get('u'));
    return await file(p);
  } catch (err) {
    return json({ error: 'Internal error', detail: String(err.message || err) }, 500);
  }
}

async function search(params) {
  const q = (params.get('q') || '').trim();
  if (!q) return json({ error: 'Missing ?q=' }, 400);
  const pages = Math.min(Math.max(parseInt(params.get('pages')) || 2, 1), 5);
  const family = params.get('family') === '1';
  const key = `${family}|${pages}|${q.toLowerCase()}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return json({ ...hit.data, cached: true });
  try {
    const data = await headless.search(q, pages, family);
    data.videos.forEach(v => videos.set(v.id, v));
    lastTrace = data.trace;
    cache.set(key, { at: Date.now(), data });
    return json(data);
  } catch (err) {
    return json({ error: 'The headless browser could not get results from dailymotion.com', detail: String(err.message || err) }, 502);
  }
}

async function file(p) {
  const f = path.join(WEB, p === '/' ? 'index.html' : p);
  if (!f.startsWith(WEB + path.sep)) return new Response('Not found', { status: 404 });
  try {
    return await net.fetch(pathToFileURL(f).toString());
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

module.exports = { handle };
