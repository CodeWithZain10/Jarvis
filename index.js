import { JarvisRuntime } from './src/runtime/jarvisLoop.js';
import { StartupService } from './src/system/startupService.js';
import logger from './src/utils/logger.js';

const args = process.argv.slice(2);

async function main() {
    const startupService = new StartupService();

    if (args.includes('--setup-startup')) {
        const res = await startupService.enableStartup();
        if (res.success) {
            console.log('Successfully setup JARVIS for Windows Auto-Startup.');
        } else {
            console.error(`Failed to setup startup: ${res.error}`);
        }
        process.exit(0);
    }

    if (args.includes('--disable-startup')) {
        const res = await startupService.disableStartup();
        if (res.success) {
            console.log('Successfully disabled JARVIS Windows Auto-Startup.');
        } else {
            console.error(`Failed to disable startup: ${res.error}`);
        }
        process.exit(0);
    }

    const isCli = args.includes('--cli') || process.env.NODE_ENV === 'development';
    const runtime = new JarvisRuntime({
        mode: isCli ? 'cli' : 'voice'
    });

    process.on('SIGINT', async () => {
        logger.info('\nReceived SIGINT signal.');
        await runtime.shutdown();
    });

    process.on('SIGTERM', async () => {
        logger.info('\nReceived SIGTERM signal.');
        await runtime.shutdown();
    });

    await runtime.start();
}

main().catch((err) => {
    logger.error(`Fatal application startup error: ${err.message}`);
    process.exit(1);
});