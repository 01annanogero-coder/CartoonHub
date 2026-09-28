import express from 'express';
import path from 'path';
import { Readable, pipeline } from 'stream';
import { fileURLToPath } from 'url';
import { search, getVideo, getLastTrace, fetchManifest, shutdown } from './scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;

app.use(express.static(path.join(__dirname, '..', 'app', 'assets', 'web')));

// GET /api/search?q=Boonie%20Bears&pages=2&family=1
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'Missing ?q=' });
  const pages = Math.min(Math.max(parseInt(req.query.pages) || 2, 1), 5);
  const family = req.query.family === '1';
  try {
    console.log(`[search] "${q}" pages=${pages} family=${family}`);
    const data = await search(q, { pages, family });
    console.log(`[search] "${q}" -> ${data.total} videos in ${data.tookMs}ms${data.cached ? ' (cache)' : ''}`);
    res.json(data);
  } catch (err) {
    console.error('[search] failed', err);
    res.status(502).json({ error: 'The headless browser could not get results from dailymotion.com', detail: String(err.message || err) });
  }
});

app.get('/api/video/:xid', (req, res) => {
  const v = getVideo(req.params.xid);
  v ? res.json(v) : res.status(404).json({ error: 'Not in cache yet' });
});

app.get('/api/trace', (_req, res) => res.json(getLastTrace()));

// ---------------------------------------------------------------- playback
// Dailymotion's CDN sends no CORS headers for this origin, so the page can't
// fetch the HLS stream itself. The master playlist comes from the headless
// browser (fetchManifest, see scraper.js); everything after that we fetch here.
// Every URI inside the playlists (absolute or relative) is rewritten to come
// back through /api/hls on this same origin.
const DM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  Referer: 'https://www.dailymotion.com/',
  Origin: 'https://www.dailymotion.com',
};
const PROXY_HOSTS = /(^|\.)(dailymotion\.com|dmcdn\.net)$/;
const M3U8 = 'application/vnd.apple.mpegurl';

function rewritePlaylist(text, base) {
  const proxied = uri => { const u = new URL(uri, base); u.hash = ''; return `/api/hls?u=${encodeURIComponent(u)}`; };
  return text.split('\n').map(line => {
    const l = line.trim();
    if (!l) return line;
    if (!l.startsWith('#')) return proxied(l);
    return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxied(uri)}"`);
  }).join('\n');
}

// GET /api/stream/x9gxeto -> master playlist for that video
app.get('/api/stream/:xid', async (req, res) => {
  try {
    const m = await fetchManifest(req.params.xid);
    if (m.error) return res.status(502).json({ error: 'No stream for this video', detail: m.error });
    res.type(M3U8).send(rewritePlaylist(m.text, m.url));
  } catch (err) {
    res.status(502).json({ error: 'Could not load the stream', detail: String(err.message || err) });
  }
});

// GET /api/hls?u=<url> -> variant playlist (rewritten) or media segment (streamed)
app.get('/api/hls', async (req, res) => {
  let u;
  try { u = new URL(String(req.query.u)); } catch { return res.status(400).json({ error: 'Bad ?u=' }); }
  if (u.protocol !== 'https:' || !PROXY_HOSTS.test(u.hostname)) return res.status(403).json({ error: 'Host not allowed' });
  try {
    const r = await fetch(u, { headers: DM_HEADERS });
    if (!r.ok) return res.status(r.status).end();
    const type = r.headers.get('content-type') || '';
    if (/mpegurl/i.test(type) || u.pathname.endsWith('.m3u8')) return res.type(M3U8).send(rewritePlaylist(await r.text(), r.url));
    res.type(type || 'video/mp2t');
    const len = r.headers.get('content-length');
    if (len) res.set('Content-Length', len);
    pipeline(Readable.fromWeb(r.body), res, () => {});
  } catch (err) {
    res.headersSent ? res.destroy() : res.status(502).json({ error: 'Could not load the stream', detail: String(err.message || err) });
  }
});

app.listen(PORT, () => console.log(`CartoonHub running on http://localhost:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await shutdown(); process.exit(0); });
