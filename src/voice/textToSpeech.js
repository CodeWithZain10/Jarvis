import { spawn } from 'child_process';
import logger from '../utils/logger.js';

export class TextToSpeechService {
    constructor(options = {}) {
        this.voice = options.voice || null; // e.g. "Microsoft Zira Desktop" or default
        this.rate = options.rate || 0; // -10 to 10
        this.volume = options.volume || 100; // 0 to 100
        this.activeProcess = null;
    }

    /**
     * Converts text to speech using Windows native SAPI synthesiser.
     * @param {string} text 
     * @returns {Promise<void>}
     */
    speak(text) {
        return new Promise((resolve) => {
            if (!text || typeof text !== 'string' || !text.trim()) {
                resolve();
                return;
            }

            const cleanText = text
                .replace(/["'\\]/g, '') // sanitize quotes
                .replace(/\r?\n|\r/g, ' ')
                .trim();

            if (!cleanText) {
                resolve();
                return;
            }

            logger.info(`Speaking: "${cleanText}"`);

            const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = ${this.rate}
$synth.Volume = ${this.volume}
$synth.Speak('${cleanText}')
`;

            const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript], {
                windowsHide: true
            });

            this.activeProcess = child;

            child.on('error', (err) => {
                logger.error(`TTS spawn error: ${err.message}`);
                this.activeProcess = null;
                resolve();
            });

            child.on('exit', () => {
                this.activeProcess = null;
                logger.debug('TTS playback finished.');
                resolve();
            });
        });
    }

    /**
     * Stops current active speech process if any.
     */
    stop() {
        if (this.activeProcess) {
            try {
                this.activeProcess.kill();
                logger.info('TTS playback stopped.');
            } catch (err) {
                // process might have already exited
            }
            this.activeProcess = null;
        }
    }
}

export default TextToSpeechService;
