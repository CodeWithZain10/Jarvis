import { launchApplication } from '../system/windowSystem.js';
import logger from '../utils/logger.js';

export class ApplicationTool {
    async execute(action, target) {
        logger.info(`ApplicationTool executing: action="${action}", target="${target}"`);
        
        if (action === 'open' || action === 'launch' || action === 'start' || action === 'run') {
            const result = await launchApplication(target);
            return result;
        }

        return {
            success: false,
            message: `Unknown action "${action}".`
        };
    }
}

export default ApplicationTool;
