import Elysia from "elysia";
import { getLlamaStatus } from "../../infra/llama";
import { llamaChatSchema } from "../../models/schemas/llama";
import { LlamaService } from "./service";

export default new Elysia({
  name: "llama",
  prefix: "/llama",
  tags: ["Llama"],
})
  .get("/status", () => getLlamaStatus())
  .post("/chat", ({ body }) => LlamaService.chat(body.message), {
    body: llamaChatSchema,
  });
