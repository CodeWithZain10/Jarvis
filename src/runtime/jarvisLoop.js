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
        this.onStateChangeCallback = options.onStateChange || null;

        this.stateMachine = new RuntimeStateMachine(STATES.STARTING);
        this.brain = new OllamaBrain();
        this.appTool = new ApplicationTool();
        this.tts = new TextToSpeechService();
        this.wakeWord = new WakeWordService();
        this.stt = new SpeechToTextService();
        this.startupService = new StartupService();

        this.isShuttingDown = false;
        this.healthCheckTimer = null;

        // Wire state machine updates to UI callback
        this.stateMachine.onStateChange(({ oldState, newState, payload }) => {
            if (this.onStateChangeCallback) {
                this.onStateChangeCallback({ oldState, newState, payload });
            }
        });
    }

    async start() {
        logger.info('Initializing JARVIS Assistant v2...');
        this._notifyUI(STATES.STARTING);

        // Non-blocking Ollama check
        const ollamaOk = await this.brain.checkAvailability();
        if (!ollamaOk) {
            logger.warn('Ollama unavailable at startup. Starting background reconnect loop...');
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
            this._notifyUI(STATES.STANDBY);
            this.stateMachine.setState(STATES.STANDBY);
            this.wakeWord.start();
            logger.info('JARVIS is ready in STANDBY mode. Say "Hey JARVIS" to activate.');
        }
    }

    /**
     * Called when wake word "Hey JARVIS" is detected.
     */
    async activateVoiceSession() {
        logger.info('Activating JARVIS session...');
        this.wakeWord.stop(); // Pause wake word engine while active

        this._notifyUI(STATES.ACTIVATING, 'Hey JARVIS');
        this.stateMachine.setState(STATES.ACTIVATING);

        const greetings = [
            "At your service. How can I help you today?",
            "Online and listening. What would you like me to do?",
            "JARVIS at your service. How can I assist you?",
            "Yes, I am listening. What do you need?",
            "Greetings! How can I help you today?"
        ];
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];

        // Speak interactive greeting
        this._notifyUI(STATES.SPEAKING, greeting);
        this.stateMachine.setState(STATES.SPEAKING);
        await this.tts.speak(greeting);

        this._notifyUI(STATES.LISTENING, '');
        this.stateMachine.setState(STATES.LISTENING);
        await this.runPersistentVoiceLoop();
    }

    /**
     * Persistent conversation loop while in ACTIVE mode.
     */
    async runPersistentVoiceLoop() {
        while (this.stateMachine.isActive() && !this.isShuttingDown) {
            try {
                this._notifyUI(STATES.LISTENING, '');
                this.stateMachine.setState(STATES.LISTENING);
                
                const spokenText = await this.stt.listen();

                if (this.isShuttingDown) break;

                // Handle silence timeout
                if (!spokenText || !spokenText.trim()) {
                    logger.debug('Silence detected. Remaining active...');
                    continue;
                }

                logger.info(`User: "${spokenText}"`);
                this._notifyUI(STATES.PROCESSING, spokenText);
                this.stateMachine.setState(STATES.PROCESSING);

                const intent = commandRouter(spokenText);
                logger.info(`Intent: ${intent.type} ${intent.actionType || intent.action || ''}`);

                const shouldContinue = await this.handleIntent(intent, spokenText);
                if (!shouldContinue) {
                    break;
                }
            } catch (err) {
                logger.error(`Error in voice loop: ${err.message}`);
                this._notifyUI(STATES.ERROR, 'Error occurred');
                this.stateMachine.setState(STATES.ERROR);
                await this.tts.speak("I encountered an error. Continuing to listen.");
                this.stateMachine.setState(STATES.LISTENING);
            }
        }
    }

    /**
     * Process routed intent and perform appropriate actions.
     */
    async handleIntent(intent, originalText) {
        // Sleep / Standby
        if (intent.type === 'sleep') {
            const msg = intent.message || "Going to standby.";
            this._notifyUI(STATES.SPEAKING, msg);
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak(msg);

            this._notifyUI(STATES.STANDBY, '');
            this.stateMachine.setState(STATES.STANDBY);
            this.wakeWord.start();
            logger.info('JARVIS returned to STANDBY mode.');
            return false;
        }

        // Exit / Shutdown
        if (intent.type === 'exit') {
            const msg = intent.message || "Shutting down JARVIS.";
            this._notifyUI(STATES.SPEAKING, msg);
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak(msg);

            this.stateMachine.setState(STATES.SHUTTING_DOWN);
            await this.shutdown();
            return false;
        }

        // Clear Context Memory
        if (intent.type === 'clear_context') {
            this.brain.clearHistory();
            const msg = "Conversation history cleared.";
            this._notifyUI(STATES.SPEAKING, msg);
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak(msg);
            return true;
        }

        // Fast Path System & Application Commands (0 Qwen3 Calls!)
        if (intent.type === 'system') {
            this._notifyUI(STATES.EXECUTING, originalText);
            this.stateMachine.setState(STATES.EXECUTING);

            const result = await this.appTool.execute(intent.actionType, intent.target || '');

            this._notifyUI(STATES.SPEAKING, result.message);
            this.stateMachine.setState(STATES.SPEAKING);
            await this.tts.speak(result.message);
            return true;
        }

        // AI Conversation / Reasoning Path (Qwen3)
        if (intent.type === 'chat') {
            if (!this.brain.isAvailable) {
                await this.brain.checkAvailability();
            }

            if (!this.brain.isAvailable) {
                const errorMsg = "Ollama AI service is currently offline.";
                this._notifyUI(STATES.SPEAKING, errorMsg);
                this.stateMachine.setState(STATES.SPEAKING);
                await this.tts.speak(errorMsg);
                return true;
            }

            // Immediately show THINKING on UI when Qwen starts processing
            this._notifyUI(STATES.THINKING, originalText);
            this.stateMachine.setState(STATES.THINKING);

            const aiReply = await this.brain.sendMessage(originalText);

            this._notifyUI(STATES.SPEAKING, aiReply);
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
        logger.info('--- JARVIS v2 CLI Development Mode ---');
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

                const lowerText = text.toLowerCase();
                if (lowerText === 'exit' || lowerText === 'exit jarvis' || lowerText === 'stop') {
                    logger.info('Exiting JARVIS via CLI.');
                    rl.close();
                    await this.shutdown();
                    return;
                }

                if (this.stateMachine.isStandby()) {
                    if (lowerText.includes('hey jarvis') || lowerText === 'activate') {
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

    _notifyUI(state, text = null) {
        if (this.onStateChangeCallback) {
            this.onStateChangeCallback({
                newState: state,
                payload: { text }
            });
        }
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
        }, 15000); // Retry every 15 seconds
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
