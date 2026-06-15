import { t } from "elysia";

export const llamaChatSchema = t.Object({
  message: t.String({ minLength: 1 }),
});

export const llamaChatResponseSchema = t.Object({
  model: t.String(),
  reply: t.String(),
});

export const llamaStatusResponseSchema = t.Object({
  enabled: t.Boolean(),
  model: t.String(),
  url: t.Optional(t.String()),
});
