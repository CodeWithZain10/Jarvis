/**
 * JARVIS Fast Hybrid Command Router
 * Deterministic intent recognition for English, Urdu, and Roman Urdu commands.
 * Directly routes known application & system commands WITHOUT invoking Qwen3 LLM.
 */

export const commandRouter = (userInput) => {
    if (!userInput || typeof userInput !== 'string') {
        return { type: 'chat', query: '' };
    }

    const input = userInput.toLowerCase().trim().replace(/[.,?!]/g, '');

    // 1. Sleep / Standby Intents
    const sleepPhrases = [
        'go to sleep',
        'go to sleep jarvis',
        'sleep jarvis',
        'sleep',
        'standby',
        'enter standby',
        'so jao',
        'so jao jarvis'
    ];
    if (sleepPhrases.includes(input) || input.endsWith('go to sleep') || input.endsWith('sleep jarvis') || input.endsWith('so jao')) {
        return {
            type: 'sleep',
            message: 'Going to standby.'
        };
    }

    // 2. Exit / Shutdown Intents
    const exitPhrases = [
        'exit jarvis',
        'stop jarvis',
        'quit jarvis',
        'exit',
        'turn off jarvis',
        'shutdown jarvis',
        'band ho jao',
        'band karo'
    ];
    if (exitPhrases.includes(input) || input === 'exit' || input === 'stop') {
        return {
            type: 'exit',
            message: 'Shutting down JARVIS. Goodbye.'
        };
    }

    // 3. Reset Context Intent
    if (input === 'clear history' || input === 'reset conversation' || input === 'clear context' || input === 'history saaf karo') {
        return {
            type: 'clear_context',
            message: 'Conversation history cleared.'
        };
    }

    // 4. Confirmations
    if (['yes', 'haan', 'ha', 'confirm', 'do it', 'yes do it'].includes(input)) {
        return { type: 'system', actionType: 'confirm_yes' };
    }

    if (['no', 'nahi', 'cancel', 'stop', 'dont do it'].includes(input)) {
        return { type: 'system', actionType: 'confirm_no' };
    }

    // 5. System Control Intents (Fast Path - Skip Qwen3)
    if (input.includes('battery') || input.includes('charge kitni hai') || input === 'battery batao') {
        return { type: 'system', actionType: 'battery_status' };
    }

    if (input.includes('volume barhao') || input.includes('volume up') || input.includes('volume high') || input.includes('volume zyada')) {
        return { type: 'system', actionType: 'volume_up' };
    }

    if (input.includes('volume kam') || input.includes('volume down') || input.includes('volume low')) {
        return { type: 'system', actionType: 'volume_down' };
    }

    if (input.includes('mute') && !input.includes('unmute')) {
        return { type: 'system', actionType: 'volume_mute' };
    }

    if (input.includes('unmute')) {
        return { type: 'system', actionType: 'volume_unmute' };
    }

    if (input.includes('screenshot') || input.includes('screen capture')) {
        return { type: 'system', actionType: 'take_screenshot' };
    }

    if (input.includes('shutdown laptop') || input.includes('laptop shutdown') || input.includes('computer shutdown')) {
        return { type: 'system', actionType: 'shutdown_request' };
    }

    if (input.includes('restart laptop') || input.includes('laptop restart')) {
        return { type: 'system', actionType: 'restart_request' };
    }

    // 6. Direct Application Launch Commands (Fast Path - Skip Qwen3)
    let appTarget = null;

    // English patterns: "open chrome", "launch vs code", "start notepad"
    if (input.startsWith("open ")) appTarget = input.slice(5).trim();
    else if (input.startsWith("launch ")) appTarget = input.slice(7).trim();
    else if (input.startsWith("start ")) appTarget = input.slice(6).trim();

    // Roman Urdu / Mixed patterns: "chrome kholo", "vs code open karo", "notepad launch karo"
    if (!appTarget) {
        if (input.endsWith(" kholo")) {
            appTarget = input.slice(0, -6).trim();
        } else if (input.endsWith(" open karo")) {
            appTarget = input.slice(0, -10).trim();
        } else if (input.endsWith(" launch karo")) {
            appTarget = input.slice(0, -12).trim();
        }
    }

    if (appTarget) {
        // Clean up common filler words e.g. "mera project vs code kholo" -> "vs code"
        appTarget = appTarget.replace(/^(mera|meri|the|a|an)\s+/, '').trim();
        return {
            type: 'system',
            actionType: 'launch_app',
            target: appTarget
        };
    }

    // 7. Fallback to Qwen3 AI Reasoning (For complex questions, explanations, general conversation)
    return {
        type: 'chat',
        query: userInput.trim()
    };
};

export default commandRouter;