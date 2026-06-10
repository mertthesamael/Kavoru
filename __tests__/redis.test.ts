import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { registerModules } from "../src/modules";
import { createResponse } from "../src/middleware/response";
import { config } from "../src/config";

describe("Redis Module", () => {
  it("returns redis status with disabled flag in test env", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(new Request("http://localhost/redis/status"))
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse(
        {
          enabled: false,
          url: config.env.redis.url ?? "",
          username: config.env.redis.username ?? "",
          connected: false,
        },
        "/redis/status",
        200,
      ),
    );
  });

  it("returns 503 when creating an entry while redis is disabled", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(
        new Request("http://localhost/redis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "demo", value: "hello" }),
        }),
      )
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse("Redis is disabled", "/redis", 503),
    );
  });

  it("returns 503 when listing keys while redis is disabled", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(new Request("http://localhost/redis"))
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse("Redis is disabled", "/redis", 503),
    );
  });
});
