import { app, BrowserWindow, ipcMain, Tray, Menu, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { JarvisRuntime } from '../runtime/jarvisLoop.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tray = null;
let jarvisRuntime = null;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    // Window dimensions
    const winWidth = 320;
    const winHeight = 170;

    // Position in bottom-right corner with 20px padding
    const x = width - winWidth - 20;
    const y = height - winHeight - 20;

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: x,
        y: y,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('close', (e) => {
        if (!app.isQuitting) {
            e.preventDefault();
            mainWindow.hide();
            logger.info('JARVIS UI minimized to background/tray.');
        }
    });
}

function createTray() {
    // Create system tray icon/menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show JARVIS UI',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Hide UI',
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Exit JARVIS',
            click: async () => {
                app.isQuitting = true;
                if (jarvisRuntime) {
                    await jarvisRuntime.shutdown();
                }
                app.quit();
            }
        }
    ]);

    // Simple tray setup (using default window icon if available)
    try {
        tray = new Tray(path.join(__dirname, 'index.html')); // Fallback icon path
        tray.setToolTip('J.A.R.V.I.S Voice Assistant');
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
    } catch {
        // Tray icon creation optional if image resource missing
    }
}

app.whenReady().then(async () => {
    createWindow();
    createTray();

    // Start JARVIS Runtime
    jarvisRuntime = new JarvisRuntime({
        mode: 'voice',
        onStateChange: ({ newState, payload }) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('state-update', {
                    state: newState,
                    text: payload?.text,
                    ollamaOnline: jarvisRuntime.brain.isAvailable
                });
            }
        }
    });

    ipcMain.on('window-minimize', () => {
        if (mainWindow) mainWindow.hide();
    });

    ipcMain.on('window-close', () => {
        if (mainWindow) mainWindow.hide();
    });

    await jarvisRuntime.start();
});

app.on('window-all-closed', () => {
    // Do not quit app when window is closed - JARVIS runs in background
});
