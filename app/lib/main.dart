// CartoonHub for Android.
//
// Everything runs on the phone:
//  - LocalServer serves the bundled HTML/CSS/JS UI on 127.0.0.1 and answers /api/search.
//  - HeadlessBrowser.kt (a hidden WebView) does the actual search on dailymotion.com.
//  - This file shows the UI in a full-screen WebView.

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'local_server.dart';

const bg = Color(0xFF070D1F);
const yellow = Color(0xFFFFC81E);
const barStyle = SystemUiOverlayStyle(
  statusBarColor: bg,
  statusBarIconBrightness: Brightness.light,
  systemNavigationBarColor: Color(0xFF080F25),
  systemNavigationBarIconBrightness: Brightness.light,
);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(barStyle);
  runApp(MaterialApp(
    title: 'CartoonHub',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(brightness: Brightness.dark, scaffoldBackgroundColor: bg, colorSchemeSeed: yellow),
    home: const Shell(),
  ));
}

class Shell extends StatefulWidget {
  const Shell({super.key});

  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  final _server = LocalServer();
  final _web = WebViewController();
  bool _loading = true;
  String? _error;
  Widget? _fullscreen; // video player shown fullscreen by the page

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      await _server.start();
    } catch (e) {
      setState(() => _error = '$e');
      return;
    }
    _web
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(bg)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) => setState(() => _loading = false),
        // Links that leave the app (e.g. "Open on Dailymotion") open in the phone's browser.
        onNavigationRequest: (req) {
          final u = Uri.tryParse(req.url);
          if (req.isMainFrame && u != null && u.host != '127.0.0.1' && u.scheme.startsWith('http')) {
            launchUrl(u, mode: LaunchMode.externalApplication);
            return NavigationDecision.prevent;
          }
          return NavigationDecision.navigate;
        },
      ));
    final ua = await _web.getUserAgent();
    await _web.setUserAgent('${ua ?? ''} CartoonHubApp');
    final android = _web.platform;
    if (android is AndroidWebViewController) {
      await android.setMediaPlaybackRequiresUserGesture(false);
      await android.setCustomWidgetCallbacks(
        onShowCustomWidget: (widget, hidden) {
          SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
          SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
          setState(() => _fullscreen = widget);
        },
        onHideCustomWidget: _exitFullscreen,
      );
    }
    await _web.loadRequest(Uri.parse(_server.origin));
  }

  void _exitFullscreen() {
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setPreferredOrientations([]);
    SystemChrome.setSystemUIOverlayStyle(barStyle);
    setState(() => _fullscreen = null);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (_fullscreen != null) {
          await _web.runJavaScript('document.exitFullscreen && document.exitFullscreen()');
          _exitFullscreen();
        } else if (await _web.canGoBack()) {
          await _web.goBack();
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: _fullscreen != null ? Colors.black : bg,
        body: _fullscreen ??
            SafeArea(
              child: Stack(children: [
                if (_error == null) WebViewWidget(controller: _web),
                if (_loading && _error == null)
                  const ColoredBox(color: bg, child: Center(child: CircularProgressIndicator(color: yellow))),
                if (_error != null)
                  Center(child: Padding(padding: const EdgeInsets.all(28), child: Text('Could not start: $_error'))),
              ]),
            ),
      ),
    );
  }
}

