// Auto-update from the latest GitHub release (electron-updater reads the
// latest.yml attached to it). A newer version downloads in the background and
// installs when the app quits, so it is running on the next launch.

const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

const RECHECK_MS = 6 * 60 * 60 * 1000; // for windows left open for days

function startUpdater() {
  if (!app.isPackaged) return; // `npm start` runs from source: nothing to update
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', info => console.log(`[updater] ${info.version} downloaded; installs on quit`));
  autoUpdater.on('error', err => console.error('[updater]', err.message));
  const check = () => autoUpdater.checkForUpdates().catch(() => {}); // offline etc.: try again later
  check();
  setInterval(check, RECHECK_MS);
}

module.exports = { startUpdater };
