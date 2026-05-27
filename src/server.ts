import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { setup } from "rivetkit";
import { match } from "./actors/match.js";
import { matchmaker } from "./actors/matchmaker.js";

const isLocalDev = process.env.NODE_ENV !== "production";

// Set up registry
const registry = setup({
  use: { match, matchmaker },
});

// Spawn embedded engine for local development only
if (isLocalDev) {
  process.env.RIVET_RUN_ENGINE = "1";
}

const app = new Hono();

// Enable CORS
app.use("*", cors());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// RivetKit handler
app.all("/api/rivet/*", (c) => registry.handler(c.req.raw));

// Serve static files in production (built by Vite)
if (!isLocalDev) {
  app.use("/*", serveStatic({ root: "./dist/client" }));
}

// Start server
const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
  console.log(`Environment: ${isLocalDev ? "development" : "production"}`);
});
