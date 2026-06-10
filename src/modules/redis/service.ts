import { status } from "elysia";
import type { Static } from "elysia";
import { getRedisClient, isRedisEnabled } from "../../infra/redis";
import type {
  createRedisEntrySchema,
  deleteRedisEntryResponseSchema,
  redisEntrySchema,
  redisListQuerySchema,
  redisListSchema,
  updateRedisEntrySchema,
} from "../../models/schemas/redis";

export type CreateRedisEntryInput = Static<typeof createRedisEntrySchema>;
export type UpdateRedisEntryInput = Static<typeof updateRedisEntrySchema>;
export type RedisListQuery = Static<typeof redisListQuerySchema>;

function requireRedisClient() {
  if (!isRedisEnabled()) {
    throw status(503, "Redis is disabled");
  }

  const client = getRedisClient();
  if (!client) {
    throw status(503, "Redis client is unavailable");
  }

  return client;
}

export abstract class RedisService {
  static async list(
    query: RedisListQuery,
  ): Promise<Static<typeof redisListSchema>> {
    const client = requireRedisClient();
    const pattern = query.pattern ?? "*";
    const limit = query.limit ?? 20;
    const keys: string[] = [];

    let cursor = "0";
    do {
      const [nextCursor, batch] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        limit,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== "0" && keys.length < limit);

    const trimmed = keys.slice(0, limit);
    return { keys: trimmed, total: trimmed.length };
  }

  static async get(key: string): Promise<Static<typeof redisEntrySchema>> {
    const client = requireRedisClient();
    const value = await client.get(key);

    if (value === null) {
      throw status(404, "Redis key not found");
    }

    const ttl = await client.ttl(key);
    return {
      key,
      value,
      ttlSeconds: ttl > 0 ? ttl : undefined,
    };
  }

  static async set(
    input: CreateRedisEntryInput,
  ): Promise<Static<typeof redisEntrySchema>> {
    const client = requireRedisClient();

    if (input.ttlSeconds) {
      await client.set(input.key, input.value, "EX", input.ttlSeconds);
    } else {
      await client.set(input.key, input.value);
    }

    return {
      key: input.key,
      value: input.value,
      ttlSeconds: input.ttlSeconds,
    };
  }

  static async update(
    key: string,
    input: UpdateRedisEntryInput,
  ): Promise<Static<typeof redisEntrySchema>> {
    const client = requireRedisClient();
    const exists = await client.exists(key);

    if (exists === 0) {
      throw status(404, "Redis key not found");
    }

    if (input.ttlSeconds) {
      await client.set(key, input.value, "EX", input.ttlSeconds);
    } else {
      await client.set(key, input.value, "KEEPTTL");
    }

    const ttl = await client.ttl(key);
    return {
      key,
      value: input.value,
      ttlSeconds: ttl > 0 ? ttl : input.ttlSeconds,
    };
  }

  static async remove(
    key: string,
  ): Promise<Static<typeof deleteRedisEntryResponseSchema>> {
    const client = requireRedisClient();
    const deleted = await client.del(key);

    if (deleted === 0) {
      throw status(404, "Redis key not found");
    }

    return { key, deleted: true };
  }
}
