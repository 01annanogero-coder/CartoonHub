// Headless-browser search wrapper for dailymotion.com.
//
// How it works:
//  1. A single headless Chromium stays open in the background.
//  2. For each search we open https://www.dailymotion.com/search/<query>/videos
//     and listen to the page's network traffic (the same data you see in the
//     DevTools "Network" tab).
//  3. The page itself calls search.dailymotion.com/v1 (GraphQL "SEARCH_QUERY").
//     We capture that request + its JSON response.
//  4. For extra pages we replay the captured request from *inside* the page
//     (same cookies, same bearer token), only changing `page`.
//  5. Every Video object found in the responses is normalised, de-duplicated,
//     filtered for relevance, sorted newest-first and grouped by date.

import { chromium } from 'playwright';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const SEARCH_API = 'search.dailymotion.com/v1';
// Don't block geo.dailymotion.com/player: the search page waits for it before searching.
const BLOCKED_HOSTS = /doubleclick|googlesyndication|googletagmanager|imasdk|dm-event\.net|amazon-adsystem|criteo|vendorlist/;
// The site asks for 240px thumbnails; we rewrite its request to get 720px ones.
const THUMB_FROM = 'PORTRAIT_240';
const THUMB_TO = 'PORTRAIT_720';
const CACHE_TTL = 15 * 60 * 1000;
const MAX_PARALLEL = 3;

let browserPromise;
const contexts = {};
const cache = new Map();          // key -> { at, data }
const videoIndex = new Map();     // xid -> normalised video (for detail screens)
let lastTrace = null;             // most recent network trace, for the inspector

let running = 0;
const queue = [];
async function withSlot(fn) {
  if (running >= MAX_PARALLEL) await new Promise(r => queue.push(r));
  running++;
  try { return await fn(); } finally { running--; queue.shift()?.(); }
}

async function getContext(family) {
  browserPromise ??= chromium.launch({ headless: true });
  const browser = await browserPromise;
  const key = family ? 'family' : 'default';
  contexts[key] ??= (async () => {
    const ctx = await browser.newContext({ userAgent: UA, locale: 'en-US', viewport: { width: 1280, height: 900 } });
    // Dailymotion's family filter cookie (used by Parental Controls).
    await ctx.addCookies([{ name: 'ff', value: family ? 'on' : 'off', domain: '.dailymotion.com', path: '/' }]);
    await ctx.route('**/*', route => {
      const req = route.request();
      if (req.url().includes(SEARCH_API) && req.method() === 'POST') {
        return route.continue({ postData: (req.postData() || '').replaceAll(THUMB_FROM, THUMB_TO) });
      }
      // Skip everything we don't need so pages load faster.
      if (['image', 'media', 'font'].includes(req.resourceType()) || BLOCKED_HOSTS.test(req.url())) return route.abort();
      return route.continue();
    });
    return ctx;
  })();
  return contexts[key];
}

// Walk any JSON and collect objects that look like Dailymotion videos.
function collectVideos(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => collectVideos(n, out)); return; }
  if (node.__typename === 'Video' && node.xid && node.title) out.push(node);
  for (const v of Object.values(node)) collectVideos(v, out);
}

function normalise(v) {
  const ch = v.creator || v.channel || {};
  return {
    id: v.xid,
    title: v.title,
    createdAt: v.createdAt,
    duration: v.duration ?? null,
    thumbnail: v.thumbnail?.url || v.thumbnailx240 || null,
    channel: {
      id: ch.xid || null,
      name: ch.displayName || ch.name || 'Unknown',
      handle: ch.name || null,
      avatar: ch.avatar?.url || ch.logoURLx25 || null,
      verified: /partner|verified/.test(ch.accountType || ''),
    },
    url: `https://www.dailymotion.com/video/${v.xid}`,
    embed: `https://www.dailymotion.com/embed/video/${v.xid}?autoplay=1`,
  };
}

const tokens = s => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);

function dateLabel(iso, now = new Date()) {
  const d = new Date(iso);
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  if (days < 31) return 'This month';
  if (d.getFullYear() === now.getFullYear()) return 'Earlier this year';
  return String(d.getFullYear());
}

function groupByDate(videos) {
  const groups = [];
  for (const v of videos) {
    const label = dateLabel(v.createdAt);
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) groups.push(g = { label, items: [] });
    g.items.push(v);
  }
  return groups;
}

export async function search(query, { pages = 2, family = false } = {}) {
  query = String(query).trim();
  const key = `${family ? 'f' : 'a'}|${pages}|${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return { ...hit.data, cached: true };

  const data = await withSlot(() => runSearch(query, pages, family));
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function runSearch(query, pages, family) {
  const t0 = Date.now();
  const ctx = await getContext(family);
  const page = await ctx.newPage();
  const trace = [];
  const raw = [];
  let template = null;

  // This is our "DevTools > Network" tap.
  page.on('requestfinished', async req => {
    const url = req.url();
    if (!/dailymotion\.com/.test(url) || !['xhr', 'fetch'].includes(req.resourceType())) return;
    const res = await req.response();
    let op = null;
    try { op = JSON.parse(req.postData() || '{}').operationName || null; } catch {}
    trace.push({ method: req.method(), url: url.split('?')[0], status: res?.status(), operation: op, ms: Math.round(req.timing().responseEnd) });
  });

  const searchUrl = `https://www.dailymotion.com/search/${encodeURIComponent(query)}/videos`;
  try {
    const firstResponse = page.waitForResponse(r => {
      if (!r.url().includes(SEARCH_API)) return false;
      try { return JSON.parse(r.request().postData() || '{}').variables?.shouldIncludeVideos === true; } catch { return false; }
    }, { timeout: 30000 });

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const res = await firstResponse;
    const req = res.request();
    template = { url: req.url(), headers: req.headers(), body: JSON.parse(req.postData().replaceAll(THUMB_FROM, THUMB_TO)) };
    let json = await res.json();
    raw.push(json);

    // Replay the captured request from inside the page for extra pages.
    let pageInfo = json?.data?.search?.videos?.pageInfo;
    for (let n = 2; n <= pages && pageInfo?.hasNextPage; n++) {
      const body = { ...template.body, variables: { ...template.body.variables, page: n } };
      const h = template.headers;
      json = await page.evaluate(async ({ url, headers, body }) => {
        const r = await fetch(url, { method: 'POST', headers, body });
        return r.ok ? r.json() : null;
      }, {
        url: template.url,
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
          authorization: h.authorization,
          'x-dm-appinfo-id': h['x-dm-appinfo-id'],
          'x-dm-appinfo-type': h['x-dm-appinfo-type'],
          'x-dm-appinfo-version': h['x-dm-appinfo-version'],
          'x-dm-preferred-country': h['x-dm-preferred-country'],
        },
      });
      if (!json) break;
      raw.push(json);
      pageInfo = json?.data?.search?.videos?.pageInfo;
    }
  } finally {
    await page.close().catch(() => {});
  }

  const found = [];
  raw.forEach(j => collectVideos(j, found));
  const seen = new Set();
  const all = found
    .map(normalise)
    .filter(v => v.createdAt && !seen.has(v.id) && seen.add(v.id));
  // Later pages drift off-topic ("Boonie Bears" -> "Chicago Bears"), which would
  // float to the top once sorted by date. Keep titles containing every search word,
  // unless that leaves almost nothing.
  const words = tokens(query);
  const strict = all.filter(v => { const t = ` ${tokens(v.title).join(' ')} `; return words.every(w => t.includes(w)); });
  const videos = (strict.length >= 5 ? strict : all)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  videos.forEach(v => videoIndex.set(v.id, v));

  const result = {
    query,
    source: searchUrl,
    total: videos.length,
    scanned: all.length,
    tookMs: Date.now() - t0,
    groups: groupByDate(videos),
    videos,
  };
  lastTrace = {
    query, source: searchUrl, at: new Date().toISOString(), tookMs: result.tookMs,
    scanned: all.length, kept: videos.length, requests: trace,
    captured: template && { url: template.url, operation: template.body.operationName, variables: template.body.variables },
  };
  result.trace = lastTrace;
  return result;
}

// Dailymotion's CDN (Cloudflare) answers the HLS master playlist with a 403
// ("E005") unless the request comes from a real browser, so we fetch the
// player metadata + master playlist from inside a page on www.dailymotion.com.
// server.js proxies the rest (variant playlists, segments) itself.
let streamPage = null;
export async function fetchManifest(xid) {
  streamPage ??= (async () => {
    const page = await (await getContext(false)).newPage();
    await page.goto('https://www.dailymotion.com/robots.txt', { timeout: 30000 });
    return page;
  })();
  try {
    return await (await streamPage).evaluate(async xid => {
      const meta = await (await fetch(`/player/metadata/video/${encodeURIComponent(xid)}`, { credentials: 'include' })).json();
      const src = meta.qualities?.auto?.[0]?.url;
      if (!src) return { error: meta.error?.title || meta.error?.message || 'No HLS stream in player metadata' };
      const r = await fetch(src, { credentials: 'include' });
      if (!r.ok) return { error: `Dailymotion refused the stream (HTTP ${r.status})` };
      return { url: r.url, text: await r.text() };
    }, xid);
  } catch (err) {
    streamPage = null; // page crashed or never loaded: open a fresh one next time
    throw err;
  }
}

export const getVideo = xid => videoIndex.get(xid) || null;
export const getLastTrace = () => lastTrace;

export async function shutdown() {
  if (browserPromise) await (await browserPromise).close().catch(() => {});
}
