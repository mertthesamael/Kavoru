import { describe, expect, it, afterEach } from "bun:test";
import { Elysia } from "elysia";
import { registerModules } from "../src/modules";
import { createResponse } from "../src/middleware/response";
import { RealtimeService } from "../src/modules/realtime/service";

describe("Realtime Module", () => {
  afterEach(() => {
    RealtimeService.reset();
  });

  it("returns connection stats over HTTP", async () => {
    const app = registerModules(new Elysia());

    const response = await app
      .handle(new Request("http://localhost/realtime/stats"))
      .then((res) => res.json());

    expect(response).toEqual(
      createResponse({ connections: 0 }, "/realtime/stats", 200),
    );
  });

  it("tracks clients in the service registry", () => {
    const client = { send() {} };

    RealtimeService.register(client);
    expect(RealtimeService.stats()).toEqual({ connections: 1 });

    RealtimeService.unregister(client);
    expect(RealtimeService.stats()).toEqual({ connections: 0 });
  });

  it("echoes validated messages back to the sender", () => {
    const sent: unknown[] = [];
    const client = {
      send(data: unknown) {
        sent.push(data);
      },
    };

    RealtimeService.register(client, "lobby");
    RealtimeService.handleMessage(client, { message: "ping" }, "lobby");

    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({
      type: "echo",
      message: "ping",
      room: "lobby",
      timestamp: expect.any(String),
    });
  });
});
