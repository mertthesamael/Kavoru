export type LlamaChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type LlamaChatResponse = {
  model: string;
  message: LlamaChatMessage;
  done: boolean;
};
