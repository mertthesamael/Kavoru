import { t } from "elysia";

export const responseSchema = t.Object({
  success: t.Boolean(),
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
