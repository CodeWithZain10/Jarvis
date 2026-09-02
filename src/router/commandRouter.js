/**
 * JARVIS Command Router
 * Deterministic intent recognition for voice and text commands.
 */

export const commandRouter = (userInput) => {
    if (!userInput || typeof userInput !== 'string') {
        return { type: 'chat', query: '' };
    }

    const input = userInput.toLowerCase().trim().replace(/[.,?!]/g, '');

    // Sleep / Standby Intents
    const sleepPhrases = [
        'go to sleep',
        'go to sleep jarvis',
        'sleep jarvis',
        'sleep',
        'standby',
        'enter standby'
    ];
    if (sleepPhrases.includes(input) || input.endsWith('go to sleep') || input.endsWith('sleep jarvis')) {
        return {
            type: 'sleep',
            message: 'Going to standby.'
        };
    }

    // Exit / Shutdown Intents
    const exitPhrases = [
        'exit jarvis',
        'stop jarvis',
        'quit jarvis',
        'exit',
        'turn off jarvis',
        'shutdown jarvis'
    ];
    if (exitPhrases.includes(input) || input === 'exit' || input === 'stop') {
        return {
            type: 'exit',
            message: 'Shutting down JARVIS. Goodbye.'
        };
    }

    // Reset Context Intent
    if (input === 'clear history' || input === 'reset conversation' || input === 'clear context') {
        return {
            type: 'clear_context',
            message: 'Conversation history cleared.'
        };
    }

    // Application Launch Commands
    let action = null;
    let target = null;

    if (input.startsWith("open ")) {
        action = "open";
        target = input.slice(5).trim();
    } else if (input.startsWith("launch ")) {
        action = "launch";
        target = input.slice(7).trim();
    } else if (input.startsWith("start ")) {
        action = "start";
        target = input.slice(6).trim();
    } else if (input.startsWith("run ")) {
        action = "run";
        target = input.slice(4).trim();
    }

    if (action && target) {
        return {
            type: 'command',
            action,
            target
        };
    }

    // Default to Chat (processed via Ollama Qwen3)
    return {
        type: 'chat',
        query: userInput.trim()
    };
};

export default commandRouter;