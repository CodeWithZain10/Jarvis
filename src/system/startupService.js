import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export class StartupService {
    constructor() {
        this.appName = 'JARVIS_Assistant';
        this.registryPath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    }

    /**
     * Configures JARVIS to run automatically at Windows startup using Windows Registry.
     * Command executed at startup: node.exe "<path_to_index.js>"
     */
    async enableStartup() {
        return new Promise((resolve) => {
            const entryPath = path.join(rootDir, 'index.js');
            const nodeExe = process.execPath; // Path to current node binary
            const commandValue = `"${nodeExe}" "${entryPath}"`;

            logger.info(`Configuring Windows Auto-Startup...`);
            logger.info(`Registry Target: ${this.registryPath}`);
            logger.info(`Registry Value Name: ${this.appName}`);
            logger.info(`Command: ${commandValue}`);

            const psScript = `Set-ItemProperty -Path "${this.registryPath}" -Name "${this.appName}" -Value '${commandValue}'`;

            exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, (err) => {
                if (err) {
                    logger.error(`Failed to set Windows startup registry key: ${err.message}`);
                    resolve({ success: false, error: err.message });
                } else {
                    logger.info(`JARVIS successfully registered for Windows auto-startup.`);
                    resolve({ success: true });
                }
            });
        });
    }

    /**
     * Removes JARVIS from Windows auto-startup.
     */
    async disableStartup() {
        return new Promise((resolve) => {
            logger.info(`Removing JARVIS from Windows Auto-Startup...`);

            const psScript = `Remove-ItemProperty -Path "${this.registryPath}" -Name "${this.appName}" -ErrorAction SilentlyContinue`;

            exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, (err) => {
                if (err) {
                    logger.error(`Failed to remove startup registry key: ${err.message}`);
                    resolve({ success: false, error: err.message });
                } else {
                    logger.info(`JARVIS auto-startup removed.`);
                    resolve({ success: true });
                }
            });
        });
    }

    /**
     * Checks if startup registry key currently exists.
     */
    async isStartupEnabled() {
        return new Promise((resolve) => {
            const psScript = `(Get-ItemProperty -Path "${this.registryPath}" -Name "${this.appName}" -ErrorAction SilentlyContinue) -ne $null`;

            exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, (err, stdout) => {
                if (err) {
                    resolve(false);
                } else {
                    resolve(stdout.trim().toLowerCase() === 'true');
                }
            });
        });
    }
}

export default StartupService;
