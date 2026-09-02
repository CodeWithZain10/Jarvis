import { exec } from 'child_process';
import logger from '../utils/logger.js';

// Safe application executable mappings
const APP_MAP = {
    'chrome': 'chrome',
    'google chrome': 'chrome',
    'browser': 'chrome',
    'vs code': 'code',
    'vscode': 'code',
    'code': 'code',
    'notepad': 'notepad',
    'calculator': 'calc',
    'calc': 'calc',
    'explorer': 'explorer',
    'file explorer': 'explorer',
    'files': 'explorer',
    'cmd': 'cmd',
    'command prompt': 'cmd',
    'powershell': 'powershell',
    'edge': 'msedge',
    'microsoft edge': 'msedge',
    'paint': 'mspaint',
    'task manager': 'taskmgr',
    'spotify': 'spotify'
};

// Dangerous tokens that must never be executed blindly
const DANGEROUS_TOKENS = [
    'rmdir', 'del', 'format', 'shutdown', 'restart', 'reg',
    'vssadmin', 'diskpart', 'attrib', 'powershell -c', 'cmd /c',
    ';', '&', '|', '`', '$', '>', '<'
];

/**
 * Validates and executes a system application request.
 * @param {string} target 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const launchApplication = (target) => {
    return new Promise((resolve) => {
        if (!target || typeof target !== 'string') {
            resolve({ success: false, message: "No application specified." });
            return;
        }

        const normalized = target.toLowerCase().trim();

        // Check for dangerous system operations
        for (const token of DANGEROUS_TOKENS) {
            if (normalized.includes(token)) {
                logger.warn(`Blocked potentially dangerous application request: "${target}"`);
                resolve({
                    success: false,
                    message: "That action requires manual authorization and cannot be executed automatically."
                });
                return;
            }
        }

        // Determine executable command
        const executable = APP_MAP[normalized] || normalized;

        logger.info(`Executing application launch: ${executable}`);

        // Launch process detached so JARVIS isn't blocked by spawned app
        exec(`start "" "${executable}"`, { windowsHide: true }, (error) => {
            if (error) {
                logger.error(`Failed to launch application "${executable}": ${error.message}`);
                resolve({
                    success: false,
                    message: `Could not launch ${target}.`
                });
            } else {
                logger.info(`Successfully launched: ${executable}`);
                resolve({
                    success: true,
                    message: `Opening ${target}.`
                });
            }
        });
    });
};

export default { launchApplication };
