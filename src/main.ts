/**
 * Application Entry Point
 */

import { bootstrap } from "./bootstrap";

// Start the application
bootstrap().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
