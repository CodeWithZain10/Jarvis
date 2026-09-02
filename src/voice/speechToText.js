import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SpeechToTextService {
    constructor(options = {}) {
        this.timeoutSeconds = parseInt(process.env.USER_SILENCE_TIMEOUT || options.timeoutSeconds || '8', 10);
        this.scriptPath = path.join(__dirname, 'sttEngine.ps1');
        this.activeProcess = null;
    }

    /**
     * Listens to microphone audio and returns transcribed text.
     * @param {Object} opts 
     * @param {number} [opts.timeoutSeconds]
     * @returns {Promise<string>}
     */
    listen(opts = {}) {
        return new Promise((resolve) => {
            const timeout = opts.timeoutSeconds || this.timeoutSeconds;
            logger.info(`Listening for user speech (timeout: ${timeout}s)...`);

            const child = spawn('powershell', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-File', this.scriptPath,
                '-TimeoutSeconds', timeout.toString()
            ], { windowsHide: true });

            this.activeProcess = child;

            let stdoutData = '';

            child.stdout.on('data', (chunk) => {
                stdoutData += chunk.toString();
            });

            child.stderr.on('data', (data) => {
                logger.debug(`STT stderr: ${data.toString().trim()}`);
            });

            child.on('error', (err) => {
                logger.error(`STT process error: ${err.message}`);
                this.activeProcess = null;
                resolve('');
            });

            child.on('exit', () => {
                this.activeProcess = null;
                try {
                    const trimmed = stdoutData.trim();
                    if (!trimmed) {
                        logger.debug('STT returned empty response.');
                        resolve('');
                        return;
                    }
                    const parsed = JSON.parse(trimmed);
                    if (parsed.success && parsed.text) {
                        logger.info(`STT Recognized: "${parsed.text}"`);
                        resolve(parsed.text);
                    } else {
                        logger.debug('STT: No speech detected within timeout.');
                        resolve('');
                    }
                } catch (err) {
                    logger.debug(`STT output parse error: ${err.message}`);
                    resolve('');
                }
            });
        });
    }

    /**
     * Cancels any ongoing listening process.
     */
    cancel() {
        if (this.activeProcess) {
            try {
                this.activeProcess.kill();
            } catch (err) {
                // process already exited
            }
            this.activeProcess = null;
        }
    }
}

export default SpeechToTextService;
