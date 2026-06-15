import { config } from "../../config";
import type { llamaStatusResponseSchema } from "../../models/schemas/llama";
import { chatWithLlama } from "./client";

export type { LlamaChatMessage, LlamaChatResponse } from "./types";

export function isLlamaEnabled() {
  return config.env.llama.enabled;
}

export function getLlamaStatus(): typeof llamaStatusResponseSchema.static {
  return {
    enabled: isLlamaEnabled(),
    model: config.env.llama.model,
    url: config.env.llama.url,
  };
}

export async function sendLlamaMessage(message: string) {
  return chatWithLlama(message);
}
