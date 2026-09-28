// A tiny HTTP server that runs inside the app on 127.0.0.1.
//
//  - Serves the bundled web UI (assets/web/...) to the visible WebView.
//  - Answers /api/search by asking the hidden WebView (HeadlessBrowser.kt)
//    to run the search on dailymotion.com.
//
// It mirrors the desktop Node server's API, so the web UI works unchanged.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

class LocalServer {
  static const _headless = MethodChannel('cartoonhub/headless');
  static const _cacheTtl = Duration(minutes: 15);

  final _cache = <String, (DateTime, Map<String, dynamic>)>{};
  final _videos = <String, dynamic>{};
  Object? _lastTrace;
  late final HttpServer _server;

  String get origin => 'http://127.0.0.1:${_server.port}';

  Future<void> start() async {
    final hook = await rootBundle.loadString('assets/headless/hook.js');
    await _headless.invokeMethod('init', {'script': hook});
    try {
      // A fixed port keeps the page origin (and its saved My List/history) stable.
      _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 8765);
    } on SocketException {
      _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    }
    _server.listen((req) => _handle(req).catchError((_) {}));
  }

  Future<void> _handle(HttpRequest req) async {
    final res = req.response;
    final path = req.uri.path;
    try {
      if (path == '/api/search') return await _search(req);
      if (path.startsWith('/api/video/')) {
        final v = _videos[path.substring('/api/video/'.length)];
        return _json(res, v ?? {'error': 'Not in cache yet'}, v == null ? 404 : 200);
      }
      if (path == '/api/trace') return _json(res, _lastTrace);
      if (path.startsWith('/api/stream/')) return await _stream(req, path.substring('/api/stream/'.length));
      if (path == '/api/hls') return await _hls(req);
      await _asset(res, path == '/' ? 'index.html' : Uri.decodeComponent(path.substring(1)));
    } catch (e) {
      _json(res, {'error': 'Internal error', 'detail': '$e'}, 500);
    }
  }

  Future<void> _search(HttpRequest req) async {
    final p = req.uri.queryParameters;
    final q = (p['q'] ?? '').trim();
    if (q.isEmpty) return _json(req.response, {'error': 'Missing ?q='}, 400);
    final pages = (int.tryParse(p['pages'] ?? '') ?? 2).clamp(1, 5);
    final family = p['family'] == '1';
    final key = '$family|$pages|${q.toLowerCase()}';

    final hit = _cache[key];
    if (hit != null && DateTime.now().difference(hit.$1) < _cacheTtl) {
      return _json(req.response, {...hit.$2, 'cached': true});
    }
    try {
      final raw = await _headless
          .invokeMethod<String>('search', {'query': q, 'pages': pages, 'family': family})
          .timeout(const Duration(seconds: 60));
      final data = jsonDecode(raw!) as Map<String, dynamic>;
      for (final v in data['videos'] as List) {
        _videos[v['id'] as String] = v;
      }
      _lastTrace = data['trace'];
      _cache[key] = (DateTime.now(), data);
      _json(req.response, data);
    } on PlatformException catch (e) {
      _json(req.response, {'error': 'The headless browser could not get results from dailymotion.com', 'detail': e.message}, 502);
    } on TimeoutException {
      _json(req.response, {'error': 'The headless browser timed out', 'detail': 'dailymotion.com took too long'}, 504);
    }
  }

  // ---------------------------------------------------------------- playback
  // Dailymotion's CDN sends no CORS headers for this origin, so the page can't
  // fetch the HLS stream itself. The master playlist comes from a hidden WebView
  // (StreamResolver.kt: the CDN refuses that one request from non-browsers);
  // everything after that we fetch here. Every URI inside the playlists
  // (absolute or relative) is rewritten to come back through /api/hls on this
  // same origin. Same API as the desktop server.js.

  static const _dmHeaders = {'Referer': 'https://www.dailymotion.com/', 'Origin': 'https://www.dailymotion.com'};
  static final _proxyHosts = RegExp(r'(^|\.)(dailymotion\.com|dmcdn\.net)$');
  static final _m3u8 = ContentType('application', 'vnd.apple.mpegurl', charset: 'utf-8');
  final _http = HttpClient()
    ..userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    ..connectionTimeout = const Duration(seconds: 15);

  Future<HttpClientResponse> _get(Uri url) async {
    final req = await _http.getUrl(url);
    _dmHeaders.forEach(req.headers.set);
    return req.close();
  }

  // The URL a response actually came from, after redirects (relative URIs resolve against it).
  static Uri _finalUrl(Uri url, HttpClientResponse res) => res.redirects.fold(url, (u, r) => u.resolveUri(r.location));

  // GET /api/stream/x9gxeto -> master playlist for that video
  Future<void> _stream(HttpRequest req, String xid) async {
    try {
      final raw = await _headless
          .invokeMethod<String>('manifest', {'xid': Uri.decodeComponent(xid)})
          .timeout(const Duration(seconds: 30));
      final m = jsonDecode(raw!) as Map<String, dynamic>;
      if (m['error'] != null) return _json(req.response, {'error': 'No stream for this video', 'detail': m['error']}, 502);
      _playlist(req.response, m['text'] as String, Uri.parse(m['url'] as String));
    } on PlatformException catch (e) {
      _json(req.response, {'error': 'Could not load the stream', 'detail': e.message}, 502);
    } on TimeoutException {
      _json(req.response, {'error': 'Could not load the stream', 'detail': 'dailymotion.com took too long'}, 504);
    }
  }

  // GET /api/hls?u=<url> -> variant playlist (rewritten) or media segment (streamed)
  Future<void> _hls(HttpRequest req) async {
    final url = Uri.tryParse(req.uri.queryParameters['u'] ?? '');
    if (url == null || url.scheme != 'https' || !_proxyHosts.hasMatch(url.host)) {
      return _json(req.response, {'error': 'Host not allowed'}, 403);
    }
    final up = await _get(url);
    final out = req.response;
    if (up.statusCode != 200) {
      await up.drain<void>();
      out.statusCode = up.statusCode;
      return out.close();
    }
    final type = up.headers.contentType?.mimeType.toLowerCase() ?? '';
    if (type.contains('mpegurl') || url.path.endsWith('.m3u8')) {
      return _playlist(out, await utf8.decodeStream(up), _finalUrl(url, up));
    }
    out.headers.contentType = up.headers.contentType ?? ContentType('video', 'mp2t');
    if (up.contentLength >= 0) out.contentLength = up.contentLength;
    await out.addStream(up);
    await out.close();
  }

  static String rewritePlaylist(String text, Uri base) {
    String proxied(String uri) => '/api/hls?u=${Uri.encodeComponent(base.resolve(uri).removeFragment().toString())}';
    return const LineSplitter().convert(text).map((line) {
      final l = line.trim();
      if (l.isEmpty) return line;
      if (!l.startsWith('#')) return proxied(l);
      return line.replaceAllMapped(RegExp(r'URI="([^"]+)"'), (m) => 'URI="${proxied(m[1]!)}"');
    }).join('\n');
  }

  void _playlist(HttpResponse res, String text, Uri base) {
    res.headers.contentType = _m3u8;
    res.headers.set('Cache-Control', 'no-cache');
    res.write(rewritePlaylist(text, base));
    res.close();
  }

  Future<void> _asset(HttpResponse res, String path) async {
    if (path.contains('..')) return _json(res, {'error': 'Not found'}, 404);
    ByteData data;
    try {
      data = await rootBundle.load('assets/web/$path');
    } catch (_) {
      res.statusCode = 404;
      return res.close();
    }
    res.headers.contentType = _types[path.split('.').last.toLowerCase()] ?? ContentType.binary;
    res.headers.set('Cache-Control', 'no-cache');
    res.add(data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes));
    await res.close();
  }

  void _json(HttpResponse res, Object? body, [int status = 200]) {
    res.statusCode = status;
    res.headers.contentType = ContentType.json;
    res.write(jsonEncode(body));
    res.close();
  }

  static final _types = {
    'html': ContentType.html,
    'css': ContentType('text', 'css', charset: 'utf-8'),
    'js': ContentType('text', 'javascript', charset: 'utf-8'),
    'json': ContentType.json,
    'svg': ContentType('image', 'svg+xml'),
    'jpg': ContentType('image', 'jpeg'),
    'jpeg': ContentType('image', 'jpeg'),
    'png': ContentType('image', 'png'),
    'webp': ContentType('image', 'webp'),
    'gif': ContentType('image', 'gif'),
    'woff2': ContentType('font', 'woff2'),
  };
}
