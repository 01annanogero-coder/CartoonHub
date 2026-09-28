# CartoonHub desktop app

Electron app for Windows. The macOS (DMG) and Linux (AppImage) build settings are
included but not tested yet. It uses the same web UI as the Android app (`../app/assets/web`),
which switches to the desktop layout (sidebar + top bar) when it runs here.

Nothing listens on a local port. The UI is served on the `app://cartoonhub/`
scheme, and the main process answers its `/api/*` requests directly:

| File          | Job                                                                    |
| ------------- | ---------------------------------------------------------------------- |
| `main.js`     | Window, `app://` scheme, external links                                 |
| `backend.js`  | `/api/search`, `/api/video`, `/api/trace`; serves the UI files          |
| `headless.js` | Hidden window that searches dailymotion.com with `../app/assets/headless/hook.js` |
| `stream.js`   | `/api/stream` + `/api/hls`: HLS playback proxy                          |
| `updater.js`  | Auto-update from the latest GitHub release (installed builds only)      |

Searches run in Electron's own Chromium, so Playwright and a separate browser
download are not needed.

## Run

```sh
npm install
npm start
```

If `npm start` prints `Cannot read properties of undefined (reading 'registerSchemesAsPrivileged')`,
the shell has `ELECTRON_RUN_AS_NODE` set (VS Code's extension host does this).
Clear it first: `set ELECTRON_RUN_AS_NODE=` (cmd) or `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell).

## Build the installer

```sh
npm run dist
```

Builds for the OS you run it on. On Windows it writes `dist/CartoonHub-Setup-<version>.exe`,
its `.blockmap` and `latest.yml`. Attach all three to the GitHub release; the
auto-updater reads `latest.yml`. The build copies the web UI and `hook.js` from
`../app/assets`, so rebuild after changing them.

macOS only installs auto-updates for code-signed apps, so an unsigned Mac build
has to be updated by hand.
