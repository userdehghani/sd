import { Elysia } from "elysia";

const app = new Elysia()

  .get("/", () => "Hello, World!")

  .listen(3005);

console.log(`🦊 Elysia is running at ${app.server?.url}`);
