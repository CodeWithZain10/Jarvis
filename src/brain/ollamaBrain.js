import ollama from 'ollama';
import logger from '../utils/logger.js';

export class OllamaBrain {
    constructor(options = {}) {
        this.host = options.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
        this.model = options.model || process.env.OLLAMA_MODEL || 'qwen3:8b';
        this.maxMessages = parseInt(process.env.MAX_CONVERSATION_MESSAGES || options.maxMessages || '20', 10);
        this.conversationHistory = [];
        this.isAvailable = false;

        this.systemPrompt = {
            role: 'system',
            content: `You are JARVIS, an always-on Windows voice assistant.
Your answers will be spoken out loud via Text-to-Speech.
Keep responses concise, natural, direct, and conversational.
Do not output markdown code blocks or long formatting unless explicitly requested.
Give short answers to simple questions (e.g. "What is 25 times 4?" -> "100.").
Never pretend to execute actions yourself if you are an AI; speak naturally as JARVIS.`
        };
    }

    /**
     * Checks if Ollama server is running and model is available.
     * Does NOT crash the application if Ollama is offline.
     */
    async checkAvailability() {
        try {
            const response = await fetch(`${this.host}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                const modelExists = data.models?.some(m => m.name.toLowerCase().startsWith(this.model.toLowerCase()));
                this.isAvailable = true;
                logger.info(`Ollama connected at ${this.host}. Target model: ${this.model} (Found: ${modelExists ? 'Yes' : 'No'})`);
                return true;
            } else {
                this.isAvailable = false;
                logger.warn(`Ollama responded with HTTP ${response.status}`);
                return false;
            }
        } catch (err) {
            this.isAvailable = false;
            logger.warn(`Ollama unavailable at ${this.host}: ${err.message}`);
            return false;
        }
    }

    /**
     * Sends a user query to Ollama while maintaining bounded conversation memory.
     * @param {string} userPrompt 
     * @returns {Promise<string>}
     */
    async sendMessage(userPrompt) {
        if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
            return "I didn't hear anything.";
        }

        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: userPrompt.trim()
        });

        // Maintain bounded conversation memory
        if (this.conversationHistory.length > this.maxMessages) {
            const overflow = this.conversationHistory.length - this.maxMessages;
            this.conversationHistory.splice(0, overflow);
            logger.debug(`Pruned ${overflow} old messages from conversation history.`);
        }

        const messages = [this.systemPrompt, ...this.conversationHistory];

        try {
            const response = await ollama.chat({
                model: this.model,
                messages: messages
            });

            let reply = response.message?.content?.trim() || "I couldn't complete that request.";
            
            // Strip any internal thinking tags if present
            reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            if (!reply) {
                reply = "I couldn't generate a response.";
            }

            // Add assistant response to history
            this.conversationHistory.push({
                role: 'assistant',
                content: reply
            });

            return reply;
        } catch (err) {
            logger.error(`Ollama chat error: ${err.message}`);
            
            // Re-check availability in case Ollama crashed/restarted
            await this.checkAvailability();
            
            return "I couldn't complete that request due to an AI service error.";
        }
    }

    /**
     * Clears conversation context history.
     */
    clearHistory() {
        this.conversationHistory = [];
        logger.info("Conversation context reset.");
    }
}

export default OllamaBrain;
