import logger from '../utils/logger.js';

export const STATES = Object.freeze({
    STARTING: 'STARTING',
    STANDBY: 'STANDBY',
    ACTIVATING: 'ACTIVATING',
    LISTENING: 'LISTENING',
    PROCESSING: 'PROCESSING',
    EXECUTING: 'EXECUTING',
    SPEAKING: 'SPEAKING',
    SHUTTING_DOWN: 'SHUTTING_DOWN',
    ERROR: 'ERROR'
});

export class RuntimeStateMachine {
    constructor(initialState = STATES.STARTING) {
        this.currentState = initialState;
        this.listeners = new Set();
    }

    getState() {
        return this.currentState;
    }

    setState(newState, payload = null) {
        if (!STATES[newState]) {
            logger.error(`Invalid state transition attempted: ${newState}`);
            return;
        }

        if (this.currentState === newState) {
            return;
        }

        const oldState = this.currentState;
        this.currentState = newState;
        logger.info(`State transition: ${oldState} -> ${newState}`);

        for (const listener of this.listeners) {
            try {
                listener({ oldState, newState, payload });
            } catch (err) {
                logger.error(`Error in state change listener: ${err.message}`);
            }
        }
    }

    onStateChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    isStandby() {
        return this.currentState === STATES.STANDBY;
    }

    isActive() {
        return (
            this.currentState === STATES.ACTIVATING ||
            this.currentState === STATES.LISTENING ||
            this.currentState === STATES.PROCESSING ||
            this.currentState === STATES.EXECUTING ||
            this.currentState === STATES.SPEAKING
        );
    }
}

export default RuntimeStateMachine;
