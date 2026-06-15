import { config } from "../../config";
import type { LlamaChatMessage, LlamaChatResponse } from "./types";

export async function chatWithLlama(
  message: string,
): Promise<LlamaChatResponse> {
  const baseUrl = config.env.llama.url;
  if (!baseUrl) {
    throw new Error("Llama URL is not configured");
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.env.llama.model,
      messages: [{ role: "user", content: message } satisfies LlamaChatMessage],
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 404) {
      throw new Error(
        `Model "${config.env.llama.model}" is not loaded yet. If using Docker, rebuild and restart llama: docker compose up -d --build llama. Or pull manually: docker compose exec llama ollama pull ${config.env.llama.model}`,
      );
    }
    throw new Error(
      detail
        ? `Upstream error (${response.status}): ${detail}`
        : `Upstream error (${response.status})`,
    );
  }

  return (await response.json()) as LlamaChatResponse;
}
