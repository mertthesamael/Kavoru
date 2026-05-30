import { t } from "elysia";

export const publishMessageSchema = t.Object({
  key: t.Optional(t.String()),
  value: t.String({ minLength: 1 }),
});

export const publishMessageResponseSchema = t.Object({
  topic: t.String(),
  partition: t.Number(),
  offset: t.String(),
});

export const kafkaStatusResponseSchema = t.Object({
  enabled: t.Boolean(),
  topic: t.String(),
  lastConsumed: t.Optional(
    t.Object({
      topic: t.String(),
      partition: t.Number(),
      offset: t.String(),
      key: t.Optional(t.String()),
      value: t.String(),
      receivedAt: t.String(),
    }),
  ),
});
