import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { JarvisRuntime } from './src/runtime/jarvisLoop.js';
import { StartupService } from './src/system/startupService.js';
import logger from './src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // CLI Development Mode
    if (args.includes('--cli') || process.env.NODE_ENV === 'development') {
        const runtime = new JarvisRuntime({ mode: 'cli' });

        process.on('SIGINT', async () => {
            logger.info('\nReceived SIGINT signal.');
            await runtime.shutdown();
        });

        process.on('SIGTERM', async () => {
            logger.info('\nReceived SIGTERM signal.');
            await runtime.shutdown();
        });

        await runtime.start();
        return;
    }

    // Direct Headless Voice Mode Flag
    if (args.includes('--voice')) {
        const runtime = new JarvisRuntime({ mode: 'voice' });

        process.on('SIGINT', async () => {
            logger.info('\nReceived SIGINT signal.');
            await runtime.shutdown();
        });

        process.on('SIGTERM', async () => {
            logger.info('\nReceived SIGTERM signal.');
            await runtime.shutdown();
        });

        await runtime.start();
        return;
    }

    // Default Voice Mode: Launch Desktop UI via Electron if launched from node entry point directly
    if (!process.env.ELECTRON_RUN_AS_NODE && !process.versions.electron) {
        try {
            const electronScript = path.join(__dirname, 'src', 'ui', 'main.js');
            logger.info('Starting JARVIS Desktop UI Window...');

            const child = spawn('npx', ['electron', electronScript], {
                stdio: 'inherit',
                shell: true
            });

            child.on('exit', async (code) => {
                if (code !== 0) {
                    logger.warn(`Electron UI exited (code ${code}). Launching direct background Voice Assistant...`);
                    const runtime = new JarvisRuntime({ mode: 'voice' });

                    process.on('SIGINT', async () => {
                        logger.info('\nReceived SIGINT signal.');
                        await runtime.shutdown();
                    });

                    process.on('SIGTERM', async () => {
                        logger.info('\nReceived SIGTERM signal.');
                        await runtime.shutdown();
                    });

                    await runtime.start();
                    return;
                }
                logger.info(`JARVIS Desktop UI exited cleanly.`);
                process.exit(0);
            });
            return;
        } catch (err) {
            logger.warn(`Could not launch Electron Desktop UI: ${err.message}. Launching direct background Voice Assistant...`);
        }
    }

    // Headless/Direct Voice Mode Fallback
    const runtime = new JarvisRuntime({ mode: 'voice' });

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