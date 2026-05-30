import { t } from "elysia";

export const wsMessageSchema = t.Object({
  message: t.String({ minLength: 1 }),
});

export const wsQuerySchema = t.Object({
  room: t.Optional(t.String()),
});

export const realtimeStatsSchema = t.Object({
  connections: t.Number(),
});

export const wsOutgoingMessageSchema = t.Object({
  type: t.Union([t.Literal("welcome"), t.Literal("echo")]),
  message: t.String(),
  timestamp: t.String(),
  room: t.Optional(t.String()),
});
