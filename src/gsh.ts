import { sleep } from "bun";
import { logger } from "./logger";
import { config } from "./config";

export async function shutdown(app: any, signal: string) {
    logger.info(`Received ${signal}. Shutting down gracefully...`, {
        signal,
        timeout: config.shutdownTimeout,
    });

    try {
        // 1. Stop accepting new connections
        logger.info("Stopping server...");
        app.stop();

        // 2. Close external resources (example placeholders)
        // await db.close()
        // await redis.quit()
        // await nats.close()

        logger.info("Waiting for in-flight requests to complete...");
        await sleep(config.shutdownTimeout);

        logger.info("Shutdown complete");
        process.exit(0);
    } catch (err) {
        logger.error("Error during shutdown", err);
        process.exit(1);
    }
}