import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { shutdown } from "./gsh";

const app = new Elysia()
  .use(openapi())
  .get("/", () => "Hello, World!")
  .listen(3005);



process.on("SIGTERM", () => shutdown(app, "SIGTERM"));
process.on("SIGINT", () => shutdown(app, "SIGINT"));


console.log(`🚀 Elysia server is running at ${app.server?.url}`);
console.log(`🚀 Elysia OpenAPI documentation is running at ${app.server?.url}openapi`);
