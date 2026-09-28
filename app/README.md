# CartoonHub for Android (Flutter)

A full-screen WebView shows the shared web UI (`assets/web`). Everything else
runs on the phone:

| File | Job |
| --- | --- |
| `lib/main.dart` | The WebView, fullscreen video, back button |
| `lib/local_server.dart` | Serves the UI and answers `/api/*` on `127.0.0.1:8765` |
| `android/.../HeadlessBrowser.kt` | Hidden WebView that runs searches on dailymotion.com with `assets/headless/hook.js` |
| `android/.../StreamResolver.kt` | Hidden WebView that fetches a video's HLS master playlist |
| `android/.../Updater.kt` | Self-update from the latest GitHub release |

```sh
flutter pub get
flutter run
flutter build apk --release
```

See the [main README](../README.md) for how it all fits together.
