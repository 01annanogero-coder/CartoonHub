// Injected into https://www.dailymotion.com pages inside the hidden WebView,
// before any of Dailymotion's own scripts run.
//
// 1. Wraps window.fetch so we can see every request the page makes and read
//    the responses (what DevTools' Network tab shows you).
// 2. When the page sends its SEARCH_QUERY to search.dailymotion.com/v1, we
//    keep a copy of the request (URL, headers incl. the bearer token, body)
//    and its JSON response, and tell the app via CHBridge.post('captured').
// 3. window.__chCollect(...) replays that request for more pages / other
//    queries, then normalises, filters, sorts by date and groups the videos,
//    and posts the finished result back with CHBridge.post('done').
(function () {
  if (window.__ch) return;
  var SEARCH_API = 'search.dailymotion.com/v1';
  var nativeFetch = window.fetch;
  var ch = (window.__ch = { template: null, first: null, firstQuery: null, trace: [] });

  function post(kind, obj) {
    try { window.CHBridge.post(kind, JSON.stringify(obj)); } catch (e) {}
  }
  function headersToObject(h) {
    var o = {};
    try { new Headers(h || {}).forEach(function (v, k) { o[k] = v; }); } catch (e) {}
    return o;
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    init = init || {};
    var method = String(init.method || (input && input.method) || 'GET').toUpperCase();
    var body = init.body;
    var isSearch = url.indexOf(SEARCH_API) >= 0 && method === 'POST' && typeof body === 'string';
    if (isSearch) {
      // Ask for 720px thumbnails instead of the 240px ones the page requests.
      body = body.split('PORTRAIT_240').join('PORTRAIT_720');
      init = Object.assign({}, init, { body: body });
    }
    var op = null;
    try { op = JSON.parse(body).operationName || null; } catch (e) {}
    var t0 = Date.now();
    var p = nativeFetch.call(this, input, init);
    if (/dailymotion\.com/.test(url)) {
      p.then(function (res) {
        ch.trace.push({ method: method, url: url.split('?')[0], status: res.status, operation: op, ms: Date.now() - t0 });
        if (!isSearch) return;
        var b = JSON.parse(body);
        if (!b.variables || !b.variables.shouldIncludeVideos) return;
        return res.clone().json().then(function (j) {
          var keep = Object.assign({}, init);
          delete keep.signal;
          delete keep.body;
          keep.headers = headersToObject(init.headers || (input && input.headers));
          ch.template = { url: url, init: keep, body: b };
          ch.first = j;
          ch.firstQuery = b.variables.query;
          post('captured', { query: b.variables.query });
        });
      }).catch(function () {});
    }
    return p;
  };

  // ---------- processing (same rules as the desktop scraper) ----------
  function collectVideos(node, out) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(function (n) { collectVideos(n, out); }); return; }
    if (node.__typename === 'Video' && node.xid && node.title) out.push(node);
    Object.keys(node).forEach(function (k) { collectVideos(node[k], out); });
  }
  function normalise(v) {
    var c = v.creator || v.channel || {};
    return {
      id: v.xid,
      title: v.title,
      createdAt: v.createdAt,
      duration: v.duration == null ? null : v.duration,
      thumbnail: (v.thumbnail && v.thumbnail.url) || v.thumbnailx240 || null,
      channel: {
        id: c.xid || null,
        name: c.displayName || c.name || 'Unknown',
        handle: c.name || null,
        avatar: (c.avatar && c.avatar.url) || c.logoURLx25 || null,
        verified: /partner|verified/.test(c.accountType || ''),
      },
      url: 'https://www.dailymotion.com/video/' + v.xid,
      embed: 'https://www.dailymotion.com/embed/video/' + v.xid + '?autoplay=1',
    };
  }
  function tokens(s) {
    return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
  }
  function dateLabel(iso, now) {
    var d = new Date(iso);
    var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var days = Math.round((day(now) - day(d)) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return 'This week';
    if (days < 31) return 'This month';
    if (d.getFullYear() === now.getFullYear()) return 'Earlier this year';
    return String(d.getFullYear());
  }
  function groupByDate(videos) {
    var now = new Date(), groups = [];
    videos.forEach(function (v) {
      var label = dateLabel(v.createdAt, now), g = groups[groups.length - 1];
      if (!g || g.label !== label) groups.push((g = { label: label, items: [] }));
      g.items.push(v);
    });
    return groups;
  }
  function pageInfo(j) {
    return j && j.data && j.data.search && j.data.search.videos && j.data.search.videos.pageInfo;
  }

  window.__chCollect = async function (id, query, pages, startedAt, fresh, source) {
    try {
      var t = ch.template;
      if (!t) throw new Error('The search page never sent SEARCH_QUERY');
      var mark = fresh ? 0 : ch.trace.length;
      var raws = [];
      var info = { hasNextPage: true };
      if (ch.first && ch.firstQuery === query) { raws.push(ch.first); info = pageInfo(ch.first); }

      for (var n = raws.length + 1; n <= pages && info && info.hasNextPage; n++) {
        var vars = Object.assign({}, t.body.variables, { query: query, page: n });
        var body = JSON.stringify(Object.assign({}, t.body, { variables: vars }));
        var t0 = Date.now();
        var res = await nativeFetch(t.url, Object.assign({}, t.init, { method: 'POST', body: body }));
        ch.trace.push({ method: 'POST', url: t.url.split('?')[0], status: res.status, operation: t.body.operationName + ' (replay p' + n + ')', ms: Date.now() - t0 });
        if (!res.ok) break;
        var j = await res.json();
        raws.push(j);
        info = pageInfo(j);
      }

      var found = [];
      raws.forEach(function (j) { collectVideos(j, found); });
      var seen = {};
      var all = found.map(normalise).filter(function (v) {
        if (!v.createdAt || seen[v.id]) return false;
        return (seen[v.id] = true);
      });
      // Later pages drift off-topic, which would float to the top once sorted by
      // date. Keep titles containing every search word unless that leaves almost nothing.
      var words = tokens(query);
      var strict = all.filter(function (v) {
        var title = ' ' + tokens(v.title).join(' ') + ' ';
        return words.every(function (w) { return title.indexOf(w) >= 0; });
      });
      var videos = (strict.length >= 5 ? strict : all).sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      var tookMs = Date.now() - startedAt;
      var trace = {
        query: query, source: source, at: new Date().toISOString(), tookMs: tookMs,
        mode: fresh ? 'Opened the search page' : 'Reused the open search page',
        scanned: all.length, kept: videos.length, requests: ch.trace.slice(mark),
        captured: { url: t.url, operation: t.body.operationName, variables: Object.assign({}, t.body.variables, { query: query }) },
      };
      post('done', { id: id, result: {
        query: query, source: source, total: videos.length, scanned: all.length, tookMs: tookMs,
        groups: groupByDate(videos), videos: videos, trace: trace,
      } });
    } catch (e) {
      post('done', { id: id, error: String((e && e.message) || e) });
    }
  };
})();
