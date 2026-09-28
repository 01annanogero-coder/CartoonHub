# Third-party notices

CartoonHub's own code is released into the public domain ([LICENSE](LICENSE)).
The components below belong to their authors and keep their own licenses.

## Included in this repository and in the apps

| Component | Where | License |
| --- | --- | --- |
| [hls.js](https://github.com/video-dev/hls.js) 1.6.13, © 2017 Dailymotion; parts derived from videojs-contrib-hls, © 2013-2015 Brightcove | `app/assets/web/vendor/hls.min.js` | Apache License 2.0: [notice](app/assets/web/vendor/hls.js.LICENSE), [full text](LICENSES/Apache-2.0.txt) |

hls.js is shipped unmodified. Its notice and the full Apache 2.0 text sit next
to it in `app/assets/web/vendor/`, so they are also inside the Android app and
the desktop app.

## Used to build or run the apps (not stored in this repository)

| Component | Used by | License |
| --- | --- | --- |
| [Flutter](https://flutter.dev) and the Flutter plugins `webview_flutter`, `webview_flutter_android`, `url_launcher` | Android app | BSD 3-Clause |
| `cupertino_icons` | Android app | MIT |
| AndroidX `webkit`, `core` | Android app | Apache License 2.0 |
| [Electron](https://www.electronjs.org) (includes Chromium; the installed app carries `LICENSE.electron.txt` and `LICENSES.chromium.html`) | Desktop app | MIT (Chromium: BSD-style and others) |
| [electron-updater](https://www.electron.build/auto-update) | Desktop app | MIT |
| [electron-builder](https://www.electron.build) | Desktop build tool | MIT |
| [Express](https://expressjs.com) | Web dev server (`server/`) | MIT |
| [Playwright](https://playwright.dev) | Web dev server (`server/`) | Apache License 2.0 |
| [Poppins](https://fonts.google.com/specimen/Poppins) and [Kalam](https://fonts.google.com/specimen/Kalam) fonts, loaded from Google Fonts at runtime | Web UI | SIL Open Font License 1.1 |

## Video content

CartoonHub hosts no videos. Every title, thumbnail, channel name and video
it shows is loaded from [Dailymotion](https://www.dailymotion.com) and belongs to
its uploader and rights holders. CartoonHub is not affiliated with or endorsed
by Dailymotion.
