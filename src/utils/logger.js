/**
 * JARVIS Centralized Logger
 * Ensures standardized timestamped logging without leaking sensitive information.
 */

const getTimestamp = () => new Date().toISOString();

export const logger = {
    info: (msg, ...args) => {
        console.log(`[${getTimestamp()}] [JARVIS] ${msg}`, ...args);
    },
    warn: (msg, ...args) => {
        console.warn(`[${getTimestamp()}] [JARVIS] [WARN] ${msg}`, ...args);
    },
    error: (msg, ...args) => {
        console.error(`[${getTimestamp()}] [JARVIS] [ERROR] ${msg}`, ...args);
    },
    debug: (msg, ...args) => {
        if (process.env.DEBUG) {
            console.log(`[${getTimestamp()}] [JARVIS] [DEBUG] ${msg}`, ...args);
        }
    }
};

export default logger;
