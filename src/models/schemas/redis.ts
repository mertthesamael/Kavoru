import { t } from "elysia";

export const redisParamsSchema = t.Object({
  key: t.String({ minLength: 1 }),
});

export const redisListQuerySchema = t.Object({
  pattern: t.Optional(t.String({ default: "*" })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
});

export const createRedisEntrySchema = t.Object({
  key: t.String({ minLength: 1 }),
  value: t.String(),
  ttlSeconds: t.Optional(t.Numeric({ minimum: 1 })),
});

export const updateRedisEntrySchema = t.Object({
  value: t.String(),
  ttlSeconds: t.Optional(t.Numeric({ minimum: 1 })),
});

export const redisEntrySchema = t.Object({
  key: t.String(),
  value: t.String(),
  ttlSeconds: t.Optional(t.Number()),
});

export const redisListSchema = t.Object({
  keys: t.Array(t.String()),
  total: t.Number(),
});

export const deleteRedisEntryResponseSchema = t.Object({
  key: t.String(),
  deleted: t.Boolean(),
});

export const redisStatusResponseSchema = t.Object({
  enabled: t.Boolean(),
  url: t.String(),
  username: t.String(),
  connected: t.Boolean(),
});
