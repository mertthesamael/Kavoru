import { status } from "elysia";
import { isLlamaEnabled, sendLlamaMessage } from "../../infra/llama";
import type { llamaChatResponseSchema } from "../../models/schemas/llama";

export abstract class LlamaService {
  static async chat(
    message: string,
  ): Promise<typeof llamaChatResponseSchema.static> {
    if (!isLlamaEnabled()) {
      throw status(503, "Llama is disabled");
    }

    try {
      const result = await sendLlamaMessage(message);
      return {
        model: result.model,
        reply: result.message.content,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      const modelMissing = detail.includes("is not loaded yet");
      throw status(modelMissing ? 503 : 502, detail);
    }
  }
}
