import { spawn } from 'child_process';
import logger from '../utils/logger.js';

export class TextToSpeechService {
    constructor(options = {}) {
        this.preferredVoice = options.voice || process.env.TTS_VOICE || 'Microsoft David Desktop';
        this.rate = options.rate !== undefined ? options.rate : 1; // Rate: -10 to 10 (1 is slightly crisp)
        this.volume = options.volume || 100; // 0 to 100
        this.activeProcess = null;
    }

    /**
     * Converts text to speech using Windows native SAPI synthesiser with selected premium voice.
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
$installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }

$targetVoice = '${this.preferredVoice}'
if ($installed -contains $targetVoice) {
    $synth.SelectVoice($targetVoice)
} else {
    # Fallback to Zira or first available voice if David is missing
    $zira = $installed | Where-Object { $_ -like "*Zira*" } | Select-Object -First 1
    if ($zira) {
        $synth.SelectVoice($zira)
    }
}

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
