import { config } from "../../config";
import { logger } from "../../common/logger";
import type { redisStatusResponseSchema } from "../../models/schemas/redis";
import { getRedisClient, resetRedisClient } from "./client";

export { getRedisClient } from "./client";

let connected = false;

export function isRedisEnabled() {
  return config.env.redis.enabled;
}

export function getRedisStatus(): typeof redisStatusResponseSchema.static {
  return {
    enabled: isRedisEnabled(),
    url: config.env.redis.url ?? "",
    username: config.env.redis.username ?? "",
    connected,
  };
}

export async function connectRedis() {
  if (!isRedisEnabled() || connected) return;

  const client = getRedisClient();
  if (!client) return;

  if (client.status === "wait") {
    await client.connect();
  }

  const ping = await client.ping();
  connected = ping === "PONG";
  logger.info("Redis connected");
}

export async function stopRedis() {
  if (!connected) return;

  const client = getRedisClient();
  if (client) {
    await client.quit();
  }

  resetRedisClient();
  connected = false;
  logger.info("Redis disconnected");
}
