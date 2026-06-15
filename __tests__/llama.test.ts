import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { registerModules } from "../src/modules";
import { createResponse } from "../src/middleware/response";
import { config } from "../src/config";

describe("Llama Module", () => {
  it("returns llama status with disabled flag in test env", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(new Request("http://localhost/llama/status"))
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse(
        {
          enabled: false,
          model: config.env.llama.model,
          url: config.env.llama.url,
        },
        "/llama/status",
        200,
      ),
    );
  });

  it("returns 503 when chatting while llama is disabled", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(
        new Request("http://localhost/llama/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "hello" }),
        }),
      )
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse("Llama is disabled", "/llama/chat", 503),
    );
  });
});
