import readline from 'readline';
import logger from '../utils/logger.js';
import { RuntimeStateMachine, STATES } from './stateMachine.js';
import { OllamaBrain } from '../brain/ollamaBrain.js';
import { commandRouter } from '../router/commandRouter.js';
import { ApplicationTool } from '../tools/applicationTool.js';
import { TextToSpeechService } from '../voice/textToSpeech.js';
import { WakeWordService } from '../voice/wakeWord.js';
import { SpeechToTextService } from '../voice/speechToText.js';
import { StartupService } from '../system/startupService.js';

export class JarvisRuntime {
    constructor(options = {}) {
        this.mode = options.mode || 'voice'; // 'voice' or 'cli'
        this.stateMachine = new RuntimeStateMachine(STATES.STARTING);
        this.brain = new OllamaBrain();
        this.appTool = new ApplicationTool();
        this.tts = new TextToSpeechService();
        this.wakeWord = new WakeWordService();
        this.stt = new SpeechToTextService();
        this.startupService = new StartupService();
        
        this.isShuttingDown = false;
        this.healthCheckTimer = null;
    }

    async start() {
        logger.info('Initializing JARVIS Assistant...');
        this.stateMachine.setState(STATES.STARTING);

        // Check Ollama connection on startup
        const ollamaOk = await this.brain.checkAvailability();
        if (!ollamaOk) {
            logger.warn('Ollama unavailable at startup. Will retry periodically in background.');
            this._startOllamaHealthCheck();
        }

        // Setup wake word trigger
        this.wakeWord.onWakeWord(async () => {
            if (this.stateMachine.isStandby()) {
                await this.activateVoiceSession();
            }
        });

        if (this.mode === 'cli') {
            await this.runCliMode();
        } else {
            this.stateMachine.setState(STATES.STANDBY);
            this.wakeWord.start();
            logger.info('JARVIS is ready and in STANDBY. Say "Hey JARVIS" to activate.');
        }
    }

    /**
     * Called when wake word "Hey JARVIS" is detected.
     * Transitions state from STANDBY to ACTIVE and runs persistent conversation loop.
     */
    async activateVoiceSession() {
        logger.info('Activating JARVIS session...');
        this.wakeWord.stop(); // Stop wake word engine while active

        this.stateMachine.setState(STATES.ACTIVATING);
        
        // Speak initial greeting "Yes?"
        this.stateMachine.setState(STATES.SPEAKING);
        await this.tts.speak("Yes?");

        this.stateMachine.setState(STATES.LISTENING);
        await this.runPersistentVoiceLoop();
    }

    /**
     * Persistent conversation loop while in ACTIVE mode.
     */
    async runPersistentVoiceLoop() {
        while (this.stateMachine.isActive() && !this.isShuttingDown) {
            try {
                this.stateMachine.setState(STATES.LISTENING);
                const spokenText = await this.stt.listen();

                if (this.isShuttingDown) break;

                // Handle empty input / silence timeout
                if (!spokenText || !spokenText.trim()) {
                    logger.debug('Silence or no speech recognized. Continuing active listening...');
                    continue;
                }

                logger.info(`User: "${spokenText}"`);

                this.stateMachine.setState(STATES.PROCESSING);
                const intent = commandRouter(spokenText);
                logger.info(`Intent: ${intent.type} ${intent.action || ''}`);

                const shouldContinue = await this.handleIntent(intent, spokenText);
                if (!shouldContinue) {
                    break;
                }
            } catch (err) {
                logger.error(`Error in voice loop: ${err.message}`);
                this.stateMachine.setState(STATES.ERROR);
                await this.tts.speak("I encountered an error. Continuing to listen.");
                this.stateMachine.setState(STATES.LISTENING);
            }
        }
    }

    /**
     * Process routed intent and perform appropriate actions.
     * @returns {Promise<boolean>} True to continue active loop, False to exit active loop (e.g. sleep/exit)
     */
    async handleIntent(intent, originalText) {
        if (intent.type === 'sleep') {
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak(intent.message || "Going to standby.");
            this.stateMachine.setState(STATES.STANDBY);
            this.wakeWord.start();
            logger.info('JARVIS returned to STANDBY mode.');
            return false;
        }

        if (intent.type === 'exit') {
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak(intent.message || "Shutting down JARVIS.");
            this.stateMachine.setState(STATES.SHUTTING_DOWN);
            await this.shutdown();
            return false;
        }

        if (intent.type === 'clear_context') {
            this.brain.clearHistory();
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak("Conversation history cleared.");
            return true;
        }

        if (intent.type === 'command') {
            this.stateMachine.setState(STATES.EXECUTING);
            const execResult = await this.appTool.execute(intent.action, intent.target);
            
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak(execResult.message);
            return true;
        }

        if (intent.type === 'chat') {
            if (!this.brain.isAvailable) {
                // Try checking availability one more time
                await this.brain.checkAvailability();
            }

            if (!this.brain.isAvailable) {
                this.stateMachine.setState(STATES.SPEAKING);
                await this.tts.speak("Ollama AI service is currently unavailable.");
                return true;
            }

            const aiReply = await this.brain.sendMessage(originalText);
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak(aiReply);
            return true;
        }

        return true;
    }

    /**
     * CLI Development Mode fallback.
     */
    async runCliMode() {
        logger.info('--- Running in CLI Development Mode ---');
        logger.info('Type "Hey JARVIS" to activate, or type requests directly.');
        logger.info('Type "go to sleep" for standby, or "exit" to quit.\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        this.stateMachine.setState(STATES.STANDBY);

        const promptUser = () => {
            const stateStr = this.stateMachine.getState();
            rl.question(`[${stateStr}] You: `, async (line) => {
                const text = line.trim();
                if (!text) {
                    promptUser();
                    return;
                }

                if (this.stateMachine.isStandby()) {
                    if (text.toLowerCase().includes('hey jarvis') || text.toLowerCase() === 'activate') {
                        logger.info('JARVIS activated via CLI.');
                        this.stateMachine.setState(STATES.ACTIVATING);
                        console.log('JARVIS: Yes?');
                        await this.tts.speak('Yes?');
                        this.stateMachine.setState(STATES.LISTENING);
                    } else {
                        console.log('JARVIS is in STANDBY. Say "Hey JARVIS" to activate.');
                    }
                    promptUser();
                    return;
                }

                // Active mode CLI processing
                this.stateMachine.setState(STATES.PROCESSING);
                const intent = commandRouter(text);

                if (intent.type === 'sleep') {
                    console.log(`JARVIS: ${intent.message}`);
                    await this.tts.speak(intent.message);
                    this.stateMachine.setState(STATES.STANDBY);
                    promptUser();
                    return;
                }

                if (intent.type === 'exit') {
                    console.log(`JARVIS: ${intent.message}`);
                    await this.tts.speak(intent.message);
                    rl.close();
                    await this.shutdown();
                    return;
                }

                const keepActive = await this.handleIntent(intent, text);
                if (keepActive) {
                    this.stateMachine.setState(STATES.LISTENING);
                    promptUser();
                } else {
                    promptUser();
                }
            });
        };

        promptUser();
    }

    _startOllamaHealthCheck() {
        if (this.healthCheckTimer) return;
        this.healthCheckTimer = setInterval(async () => {
            if (!this.brain.isAvailable) {
                const ok = await this.brain.checkAvailability();
                if (ok && this.healthCheckTimer) {
                    clearInterval(this.healthCheckTimer);
                    this.healthCheckTimer = null;
                }
            }
        }, 30000); // Retry every 30 seconds
    }

    async shutdown() {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;
        logger.info('Gracefully shutting down JARVIS process and voice services...');

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        this.wakeWord.stop();
        this.stt.cancel();
        this.tts.stop();

        logger.info('Shutdown complete.');
        process.exit(0);
    }
}

export default JarvisRuntime;
