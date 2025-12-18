import { sleep } from "bun";

export async function shutdown(app: any, signal: string) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    try {
        // 1. Stop accepting new connections
        app.stop();

        // 2. Close external resources (example placeholders)
        // await db.close()
        // await redis.quit()
        // await nats.close()

        await sleep(10_000);
        process.exit(0);
    } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
    }
}