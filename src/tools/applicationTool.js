import windowSystem from '../system/windowSystem.js';
import logger from '../utils/logger.js';

export class ApplicationTool {
    async execute(actionType, target = '') {
        logger.info(`ApplicationTool executing: actionType="${actionType}", target="${target}"`);
        return await windowSystem.executeAction(actionType, target);
    }
}

export default ApplicationTool;
