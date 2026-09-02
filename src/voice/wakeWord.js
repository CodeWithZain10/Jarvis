import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WakeWordService {
    constructor() {
        this.callbacks = new Set();
        this.process = null;
        this.isRunning = false;
        this.scriptPath = path.join(__dirname, 'wakeWordEngine.ps1');
    }

    /**
     * Registers a callback to be called when the wake word "Hey JARVIS" is detected.
     * @param {Function} callback 
     */
    onWakeWord(callback) {
        if (typeof callback === 'function') {
            this.callbacks.add(callback);
        }
    }

    /**
     * Removes a registered wake word callback.
     * @param {Function} callback 
     */
    offWakeWord(callback) {
        this.callbacks.delete(callback);
    }

    /**
     * Starts listening for the wake word "Hey JARVIS".
     */
    start() {
        if (this.isRunning) {
            logger.debug('Wake word service is already running.');
            return;
        }

        logger.info('Starting wake-word listener (phrase: "Hey JARVIS")...');
        this.isRunning = true;

        this.process = spawn('powershell', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', this.scriptPath
        ], { windowsHide: true });

        this.process.stdout.on('data', (data) => {
            const lines = data.toString().split(/\r?\n/);
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed === 'WAKEWORD_LISTENER_READY') {
                    logger.info('Wake-word listener active (STANDBY).');
                } else if (trimmed === 'WAKEWORD_DETECTED') {
                    logger.info('Wake word detected!');
                    this._notifyWakeWord();
                } else if (trimmed.startsWith('WAKEWORD_ERROR:')) {
                    logger.error(`Wake-word engine error: ${trimmed}`);
                }
            }
        });

        this.process.stderr.on('data', (data) => {
            logger.debug(`Wake-word stderr: ${data.toString().trim()}`);
        });

        this.process.on('exit', (code) => {
            logger.debug(`Wake-word process exited with code ${code}`);
            this.isRunning = false;
            this.process = null;
        });

        this.process.on('error', (err) => {
            logger.error(`Wake-word process error: ${err.message}`);
            this.isRunning = false;
            this.process = null;
        });
    }

    /**
     * Stops listening for the wake word.
     */
    stop() {
        if (!this.isRunning && !this.process) {
            return;
        }

        logger.info('Stopping wake-word listener...');
        this.isRunning = false;

        if (this.process) {
            try {
                this.process.kill();
            } catch (err) {
                // Ignore if process already closed
            }
            this.process = null;
        }
    }

    _notifyWakeWord() {
        for (const cb of this.callbacks) {
            try {
                cb();
            } catch (err) {
                logger.error(`Error in wake word callback: ${err.message}`);
            }
        }
    }
}

export default WakeWordService;
