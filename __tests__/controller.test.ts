import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { registerModules } from "../src/modules";
import { createResponse } from "../src/middleware/response";

describe("Elysia Controller", () => {
  it("returns a response", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(new Request("http://localhost/healthz"))
      .then((res) => res.json());

    expect(response).toEqual(createResponse("ok", "/healthz", 200));
  });
  it("returns a 404 response", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(new Request("http://localhost/not-found"))
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse({ message: "Not Found" }, "/not-found", 404),
    );
  });
  it("returns proper response from post request", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(
        new Request("http://localhost/healthz/echo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "ping" }),
        }),
      )
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse({ message: "pong" }, "/healthz/echo", 200),
    );
  });
});
