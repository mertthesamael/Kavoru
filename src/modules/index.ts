import { Elysia } from "elysia";
import { responseMiddleware } from "../middleware/response";
import { watch, utimesSync } from "fs";
import path from "path";
import { config } from "../config";
import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import { withSentry } from "../infra/sentry";
import { withOpenTelemetry } from "../infra/telemetry";
import { routeModules } from "./routes.registry";

const isCompiledBinary = import.meta.path.includes("$bunfs");
const enableDevWatcher =
  config.env.env !== "production" && !isCompiledBinary;

if (enableDevWatcher) {
  const modulesDir = import.meta.dir;
  const routeGlob = new Bun.Glob("*/routes.ts");
  const knownRouteFiles = new Set<string>();
  for (const file of routeGlob.scanSync(modulesDir)) {
    knownRouteFiles.add(file.replaceAll("\\", "/"));
  }

  const watcher = watch(modulesDir, { recursive: true }, (_event, filename) => {
    if (!filename?.endsWith("routes.ts")) return;
    const normalized = filename.replaceAll("\\", "/");
    if (knownRouteFiles.has(normalized)) return;
    knownRouteFiles.add(normalized);
    watcher.close();

    Bun.spawnSync({
      cmd: ["bun", "run", "routes:registry"],
      cwd: path.join(modulesDir, "../.."),
      stdout: "inherit",
      stderr: "inherit",
    });

    const now = new Date();
    utimesSync(import.meta.path, now, now);
  });

  watcher.unref();
}

function useRouteModules(app: Elysia) {
  for (const mod of routeModules) {
    for (const exported of Object.values(mod)) {
      if (exported instanceof Elysia) {
        app.use(exported);
      }
    }
  }
}

export function registerModules(app: Elysia) {
  app
    .use(withSentry)
    .use(withOpenTelemetry)
    .use(
      openapi({
        path: "/help",
        documentation: {
          info: {
            title: "🦊 Kavoru",
            version: config.version,
            description: "Built for humans.",
          },
        },
      }),
    )
    .use(cors())
    .use(responseMiddleware);

  useRouteModules(app);

  app.all("/*", function notFound({ set }) {
    set.status = 404;
    return { message: "Not Found" };
  });

  return app;
}
