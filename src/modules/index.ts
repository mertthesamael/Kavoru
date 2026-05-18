import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { responseMiddleware } from "../middleware/response";
import { watch, utimesSync } from "fs";
import path from "path";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { config } from "../config";
import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import bearer from "@elysiajs/bearer";
import { telemetryMiddleware } from "../middleware/telemetry";

const modulesDir = import.meta.dir;
const routeGlob = new Bun.Glob("*/routes.ts");

const knownRouteFiles = new Set<string>();
for (const file of routeGlob.scanSync(modulesDir)) {
  knownRouteFiles.add(file.replaceAll("\\", "/"));
}

if (process.env.NODE_ENV !== "production") {
  const watcher = watch(modulesDir, { recursive: true }, (_event, filename) => {
    if (!filename?.endsWith("routes.ts")) return;
    const normalized = filename.replaceAll("\\", "/");
    if (knownRouteFiles.has(normalized)) return;
    knownRouteFiles.add(normalized);
    watcher.close();
    const now = new Date();
    utimesSync(import.meta.path, now, now);
  });

  watcher.unref();
}

export function registerModules(app: Elysia) {
  app
    .use(
      openapi({
        path: "/help",
        documentation: {
          info: {
            title: "🦊 Elysia Template",
            version: config.version,
            description: "Built for humans.",
          },
        },
      }),
    )
    .use(cors())
    /*.use(
      opentelemetry({
        spanProcessors: [
          new BatchSpanProcessor(
            new OTLPTraceExporter({
              url: config.env.server.otelExporterOtlpEndpoint,
            }),
          ),
        ],
      }),
    )*/
    .use((app) =>
      config.env.server.traceRequests ? app.use(telemetryMiddleware) : app,
    )
    .use(responseMiddleware);

  for (const file of knownRouteFiles) {
    const mod = require(path.join(modulesDir, file));
    for (const exported of Object.values(mod)) {
      if (exported instanceof Elysia) {
        app.use(exported);
      }
    }
  }

  return app;
}
