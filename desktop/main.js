// CartoonHub for Windows (Electron).
//
// Everything runs inside this app; there is no local HTTP port:
//  - The web UI (app/assets/web, shared with the Android app) is served on the
//    app://cartoonhub/ scheme, and so are the /api/* routes it calls (backend.js).
//  - Searches run in a hidden window on dailymotion.com (headless.js).
//  - Video streams are proxied through the same scheme (stream.js).
//  - New versions come from the latest GitHub release (updater.js).

const { app, BrowserWindow, Menu, protocol, screen, shell } = require('electron');
const path = require('path');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

// Look like plain Chrome to dailymotion.com (no "Electron/..." in the user agent).
app.userAgentFallback = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;

function createWindow() {
  // Fit the screen: at 150% Windows scaling a 1080p laptop only has ~1280x690 to offer.
  const area = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1440, area.width),
    height: Math.min(900, area.height),
    minWidth: 1000,
    minHeight: 600,
    title: 'CartoonHub',
    backgroundColor: '#070d1f',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  // Links that leave the app (e.g. "Open on Dailymotion") open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('app://')) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });
  // The hidden search/stream windows would otherwise keep the app alive.
  win.on('closed', () => app.quit());
  win.loadURL('app://cartoonhub/index.html');
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle('app', require('./backend').handle);
  createWindow();
  require('./updater').startUpdater();
});
