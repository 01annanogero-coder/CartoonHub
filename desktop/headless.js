// The app's "headless browser": a hidden window the user never sees. It is the
// desktop port of HeadlessBrowser.kt and runs the same hook.js.
//
// For a search it opens https://www.dailymotion.com/search/<query>/videos.
// hook.js is injected before the page's own scripts run (through the Chrome
// DevTools Protocol, the way Playwright does it); it wraps window.fetch, grabs
// the page's SEARCH_QUERY request and response, replays that request for more
// pages, sorts the videos by date and posts the finished JSON back here.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const HOOK = app.isPackaged ? path.join(process.resourcesPath, 'hook.js') : path.join(__dirname, '..', 'app', 'assets', 'headless', 'hook.js');
const PARTITION = 'persist:dailymotion';
const REUSE_MS = 20 * 60 * 1000;
const JOB_TIMEOUT = 45000;
// Don't block geo.dailymotion.com/player: the search page waits for it before searching.
const BLOCKED = /doubleclick|googlesyndication|googletagmanager|imasdk|dm-event\.net|amazon-adsystem|criteo|vendorlist|google-analytics/;
const MEDIA = /\.(mp4|m3u8|m4s|ts|webm|woff2?|ttf|png|jpe?g|gif|webp|svg)(\?|$)/;

const searchUrl = q => `https://www.dailymotion.com/search/${encodeURIComponent(q)}/videos`;

let windowPromise = null;
let web = null;            // the hidden BrowserWindow once it is ready
let templateAt = 0;        // when the open page last captured SEARCH_QUERY
let loadedFamily = null;
let jobSeq = 0;
let current = null;
const queue = [];

function getWindow() {
  windowPromise ??= (async () => {
    const w = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { partition: PARTITION, backgroundThrottling: false, sandbox: true } });
    const id = w.webContents.id;
    // Skip everything we don't need so pages load faster (only for this window:
    // stream.js shares the session and must be able to fetch .m3u8 files).
    w.webContents.session.webRequest.onBeforeRequest((d, cb) => {
      const skip = d.webContentsId === id && d.resourceType !== 'mainFrame' &&
        (BLOCKED.test(d.url) || MEDIA.test(d.url) || ['image', 'media', 'font'].includes(d.resourceType));
      cb({ cancel: skip });
    });

    // DevTools commands sent before the window has any page never get an answer.
    await w.loadURL('about:blank');
    const dbg = w.webContents.debugger;
    dbg.attach('1.3');
    dbg.on('message', (_e, method, params) => {
      if (method === 'Runtime.bindingCalled' && params.name === '__chPost') onPost(...JSON.parse(params.payload));
    });
    await dbg.sendCommand('Runtime.enable');
    await dbg.sendCommand('Page.enable');
    await dbg.sendCommand('Runtime.addBinding', { name: '__chPost' });
    await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: `if (location.hostname === 'www.dailymotion.com' && window.top === window) {
        window.CHBridge = { post: function (kind, payload) { window.__chPost(JSON.stringify([kind, payload])); } };
        ${fs.readFileSync(HOOK, 'utf8')}
      }`,
    });
    w.on('closed', () => { windowPromise = null; web = null; templateAt = 0; });
    return (web = w);
  })();
  return windowPromise;
}

function search(query, pages, family) {
  return new Promise((resolve, reject) => {
    queue.push({ query, pages, family, resolve, reject });
    if (!current) next();
  });
}

async function next() {
  const job = queue.shift();
  if (!job) return;
  current = job;
  job.id = ++jobSeq;
  job.start = Date.now();
  job.timer = setTimeout(() => finish(job, null, 'Timed out waiting for dailymotion.com'), JOB_TIMEOUT);

  let w;
  try {
    w = await getWindow();
  } catch (err) {
    windowPromise = null;
    return finish(job, null, String(err.message || err));
  }
  const pageIsWarm = templateAt > 0 && loadedFamily === job.family && Date.now() - templateAt < REUSE_MS;
  if (pageIsWarm) return collect(job, false); // reuse the open search page's captured request

  templateAt = 0;
  loadedFamily = job.family;
  // Dailymotion's family filter cookie (used by Parental Controls).
  await w.webContents.session.cookies.set({ url: 'https://www.dailymotion.com', name: 'ff', value: job.family ? 'on' : 'off', domain: '.dailymotion.com', path: '/' });
  job.waitingForPage = true;
  w.loadURL(searchUrl(job.query)).catch(err => {
    if (err.code !== 'ERR_ABORTED' && current === job && job.waitingForPage) finish(job, null, `Could not open dailymotion.com (${err.code || err.message})`);
  });
}

function collect(job, fresh) {
  job.waitingForPage = false;
  const args = [job.id, JSON.stringify(job.query), job.pages, job.start, fresh, JSON.stringify(searchUrl(job.query))];
  web?.webContents.executeJavaScript(`window.__chCollect && window.__chCollect(${args.join(',')})`).catch(() => {});
}

function onPost(kind, payload) {
  const job = current;
  if (!job) return;
  if (kind === 'captured') {
    // The page's own SEARCH_QUERY request was captured.
    templateAt = Date.now();
    if (job.waitingForPage) collect(job, true);
  } else if (kind === 'done') {
    const o = JSON.parse(payload);
    if (o.id !== job.id) return;
    o.error ? finish(job, null, o.error) : finish(job, o.result, null);
  }
}

function finish(job, result, error) {
  if (current !== job) return;
  clearTimeout(job.timer);
  current = null;
  if (error) {
    templateAt = 0; // force a fresh page load next time
    job.reject(new Error(error));
  } else job.resolve(result);
  next();
}

module.exports = { search };
