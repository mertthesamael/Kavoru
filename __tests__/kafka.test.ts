import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { registerModules } from "../src/modules";
import { createResponse } from "../src/middleware/response";
import { config } from "../src/config";

describe("Kafka Module", () => {
  it("returns kafka status with disabled flag in test env", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(new Request("http://localhost/kafka/status"))
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse(
        {
          enabled: false,
          topic: config.env.kafka.topic,
        },
        "/kafka/status",
        200,
      ),
    );
  });

  it("returns 503 when publishing while kafka is disabled", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(
        new Request("http://localhost/kafka/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: "hello" }),
        }),
      )
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse("Kafka is disabled", "/kafka/publish", 503),
    );
  });
});
