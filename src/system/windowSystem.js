import { exec } from 'child_process';
import logger from '../utils/logger.js';
import systemCommands from './systemCommands.js';

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

class WindowSystem {
    constructor() {
        this.pendingAction = null;
    }

    /**
     * Executes or requests confirmation for system/application actions.
     * @param {string} actionType 
     * @param {string} target 
     * @returns {Promise<{success: boolean, message: string, requiresConfirmation?: boolean}>}
     */
    async executeAction(actionType, target = '') {
        // Confirmation handling
        if (actionType === 'confirm_yes') {
            if (this.pendingAction) {
                const action = this.pendingAction;
                this.pendingAction = null;
                return await this._performDangerousAction(action);
            } else {
                return { success: true, message: "No action was waiting for confirmation." };
            }
        }

        if (actionType === 'confirm_no') {
            this.pendingAction = null;
            return { success: true, message: "Action canceled." };
        }

        // Dangerous actions requiring confirmation
        if (actionType === 'shutdown_request') {
            this.pendingAction = 'shutdown';
            return {
                success: true,
                message: "Are you sure you want to shut down the laptop?",
                requiresConfirmation: true
            };
        }

        if (actionType === 'restart_request') {
            this.pendingAction = 'restart';
            return {
                success: true,
                message: "Are you sure you want to restart the laptop?",
                requiresConfirmation: true
            };
        }

        // System Control Actions (Direct Fast Execution)
        if (actionType === 'battery_status') {
            return await systemCommands.getBatteryStatus();
        }

        if (actionType === 'volume_up') {
            return await systemCommands.adjustVolume('up');
        }

        if (actionType === 'volume_down') {
            return await systemCommands.adjustVolume('down');
        }

        if (actionType === 'volume_mute') {
            return await systemCommands.adjustVolume('mute');
        }

        if (actionType === 'volume_unmute') {
            return await systemCommands.adjustVolume('unmute');
        }

        if (actionType === 'take_screenshot') {
            return await systemCommands.takeScreenshot();
        }

        // Application launch
        if (actionType === 'launch_app' || actionType === 'open') {
            return await this.launchApplication(target);
        }

        return { success: false, message: `Unknown system action: ${actionType}` };
    }

    /**
     * Executes dangerous action after explicit user confirmation.
     */
    _performDangerousAction(action) {
        return new Promise((resolve) => {
            if (action === 'shutdown') {
                logger.warn('Executing user-confirmed system shutdown...');
                exec('shutdown /s /t 10', (err) => {
                    if (err) {
                        resolve({ success: false, message: "Could not initiate shutdown." });
                    } else {
                        resolve({ success: true, message: "Shutting down the laptop in 10 seconds." });
                    }
                });
            } else if (action === 'restart') {
                logger.warn('Executing user-confirmed system restart...');
                exec('shutdown /r /t 10', (err) => {
                    if (err) {
                        resolve({ success: false, message: "Could not initiate restart." });
                    } else {
                        resolve({ success: true, message: "Restarting the laptop in 10 seconds." });
                    }
                });
            } else {
                resolve({ success: false, message: "Action canceled." });
            }
        });
    }

    /**
     * Safe launcher for applications.
     */
    launchApplication(target) {
        return new Promise((resolve) => {
            if (!target || typeof target !== 'string') {
                resolve({ success: false, message: "No application specified." });
                return;
            }

            const normalized = target.toLowerCase().trim();
            const executable = APP_MAP[normalized] || normalized;

            logger.info(`Executing application launch: ${executable}`);

            exec(`start "" "${executable}"`, { windowsHide: true }, (error) => {
                if (error) {
                    logger.error(`Failed to launch application "${executable}": ${error.message}`);
                    resolve({
                        success: false,
                        message: `Could not open ${target}.`
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
    }
}

export const windowSystem = new WindowSystem();
export default windowSystem;
