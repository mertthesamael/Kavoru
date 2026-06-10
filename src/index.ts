import { initSentry, flushSentry } from "./infra/sentry";
import {
  bootstrapOpenTelemetry,
  shutdownOpenTelemetry,
} from "./infra/telemetry";
import { startKafka, stopKafka } from "./infra/kafka";
import { connectRedis, stopRedis } from "./infra/redis";
import { HttpServer } from "./server/index";
import { logger } from "./common/logger";
import { InternalServerError } from "elysia";

bootstrapOpenTelemetry();
initSentry();

const server = new HttpServer();

void server.start().then(async () => {
  try {
    await startKafka();
    await connectRedis();
  } catch (error) {
    logger.error("Failed to start infrastructure", { error });
    throw new InternalServerError("Failed to start infrastructure");
  }
});

const shutdown = (signal: string) => {
  return async () => {
    logger.warn(`Received ${signal}, shutting down`);
    await server.stop();
    await stopKafka();
    await stopRedis();
    await flushSentry();
    await shutdownOpenTelemetry();
    process.exit(0);
  };
};

process.on("SIGINT", () => void shutdown("SIGINT")());
process.on("SIGTERM", () => void shutdown("SIGTERM")());
