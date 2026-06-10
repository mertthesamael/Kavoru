import Redis from "ioredis";
import { config } from "../../config";

let redis: Redis | null = null;

export function getRedisClient() {
  if (!config.env.redis.enabled || !config.env.redis.url) return null;

  if (!redis) {
    const { url, username, password } = config.env.redis;
    redis = new Redis(url, {
      username: username || undefined,
      password: password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  return redis;
}

export function resetRedisClient() {
  redis = null;
}
