import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import logger from '../utils/logger.js';

export const systemCommands = {
    /**
     * Retrieves current battery status and percentage.
     * @returns {Promise<{success: boolean, message: string}>}
     */
    getBatteryStatus: () => {
        return new Promise((resolve) => {
            const psCmd = `Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus | ConvertTo-Json -Compress`;
            exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, (err, stdout) => {
                if (err || !stdout.trim()) {
                    // Try fallback for desktop without battery or error
                    logger.warn('Could not query battery via CimInstance, checking WMI fallback...');
                    const fallbackCmd = `Get-WmiObject Win32_Battery | Select-Object EstimatedChargeRemaining | ConvertTo-Json -Compress`;
                    exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${fallbackCmd}"`, (err2, stdout2) => {
                        if (err2 || !stdout2.trim()) {
                            resolve({
                                success: true,
                                message: "System is running on AC power. No battery detected."
                            });
                        } else {
                            try {
                                const data = JSON.parse(stdout2.trim());
                                const pct = data.EstimatedChargeRemaining;
                                resolve({
                                    success: true,
                                    message: `Battery is currently at ${pct} percent.`
                                });
                            } catch {
                                resolve({ success: true, message: "System is connected to power." });
                            }
                        }
                    });
                } else {
                    try {
                        const data = JSON.parse(stdout.trim());
                        const pct = data.EstimatedChargeRemaining;
                        const status = data.BatteryStatus === 2 ? "charging" : "discharging";
                        resolve({
                            success: true,
                            message: `Battery is at ${pct} percent and currently ${status}.`
                        });
                    } catch {
                        resolve({ success: true, message: "Could not read battery level." });
                    }
                }
            });
        });
    },

    /**
     * Adjusts system master volume (up, down, mute, unmute).
     * @param {'up' | 'down' | 'mute' | 'unmute'} action 
     * @returns {Promise<{success: boolean, message: string}>}
     */
    adjustVolume: (action) => {
        return new Promise((resolve) => {
            let keyChar = '';
            let msg = '';
            let repeatCount = 5;

            if (action === 'up') {
                keyChar = '[char]175';
                msg = 'Increasing volume.';
            } else if (action === 'down') {
                keyChar = '[char]174';
                msg = 'Decreasing volume.';
            } else if (action === 'mute' || action === 'unmute') {
                keyChar = '[char]173';
                msg = action === 'mute' ? 'Muting audio.' : 'Unmuting audio.';
                repeatCount = 1;
            }

            const sendKeysScript = `
$w = New-Object -ComObject WScript.Shell
for ($i = 0; $i -lt ${repeatCount}; $i++) {
    $w.SendKeys(${keyChar})
    Start-Sleep -Milliseconds 50
}
`;

            exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${sendKeysScript}"`, (err) => {
                if (err) {
                    logger.error(`Volume adjustment failed: ${err.message}`);
                    resolve({ success: false, message: 'Could not adjust volume.' });
                } else {
                    logger.info(`Volume action executed: ${action}`);
                    resolve({ success: true, message: msg });
                }
            });
        });
    },

    /**
     * Captures a screenshot of the main display and saves it to Pictures.
     * @returns {Promise<{success: boolean, message: string, filePath?: string}>}
     */
    takeScreenshot: () => {
        return new Promise((resolve) => {
            const picturesDir = path.join(os.homedir(), 'Pictures', 'JARVIS_Screenshots');
            if (!fs.existsSync(picturesDir)) {
                fs.mkdirSync(picturesDir, { recursive: true });
            }

            const fileName = `Screenshot_${Date.now()}.png`;
            const savePath = path.join(picturesDir, fileName);

            const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)

$bitmap.Save('${savePath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;

            exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${script}"`, (err) => {
                if (err) {
                    logger.error(`Screenshot failed: ${err.message}`);
                    resolve({ success: false, message: 'Failed to capture screenshot.' });
                } else {
                    logger.info(`Screenshot saved to ${savePath}`);
                    // Open the screenshot folder or image safely
                    exec(`explorer.exe /select,"${savePath}"`);
                    resolve({
                        success: true,
                        message: 'Screenshot captured and saved to your Pictures folder.',
                        filePath: savePath
                    });
                }
            });
        });
    }
};

export default systemCommands;
