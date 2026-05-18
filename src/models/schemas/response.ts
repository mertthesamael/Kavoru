import { t } from "elysia";

export const responseSchema = t.Object({
  success: t.Boolean(),
  /** `onRequest` trace child duration (ms); not full request time */
  elapsedMs: t.Optional(t.String()),
  /** ms from `onRequest` through handler + this envelope (monotonic clock) */
  responseElapsedMs: t.Optional(t.String()),
  data: t.Optional(t.Any()),
  error: t.Optional(
    t.Object({
      code: t.String(),
      message: t.String(),
      details: t.Optional(t.Any()),
    }),
  ),
  timestamp: t.String(),
  path: t.String(),
});
