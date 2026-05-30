import { logger } from "../../common/logger";
import type {
  realtimeStatsSchema,
  wsMessageSchema,
  wsOutgoingMessageSchema,
} from "../../models/schemas/realtime";

const OPEN = 1;

type RealtimeClient = {
  send(data: string | ArrayBuffer | object): void;
  readyState?: number;
};

const clients = new Set<RealtimeClient>();

export abstract class RealtimeService {
  static register(client: RealtimeClient, room?: string) {
    clients.add(client);

    const welcome: typeof wsOutgoingMessageSchema.static = {
      type: "welcome",
      message: "Connected to elysia-template realtime",
      timestamp: new Date().toISOString(),
      ...(room ? { room } : {}),
    };

    client.send(welcome);
    logger.info("WebSocket client connected", { connections: clients.size, room });
  }

  static unregister(client: RealtimeClient) {
    clients.delete(client);
    logger.info("WebSocket client disconnected", {
      connections: clients.size,
    });
  }

  static handleMessage(
    client: RealtimeClient,
    payload: typeof wsMessageSchema.static,
    room?: string,
  ) {
    const response: typeof wsOutgoingMessageSchema.static = {
      type: "echo",
      message: payload.message,
      timestamp: new Date().toISOString(),
      ...(room ? { room } : {}),
    };

    client.send(response);
  }

  static stats(): typeof realtimeStatsSchema.static {
    return { connections: clients.size };
  }

  static broadcast(payload: typeof wsOutgoingMessageSchema.static) {
    for (const client of clients) {
      if (client.readyState === undefined || client.readyState === OPEN) {
        client.send(payload);
      }
    }
  }

  /** Test helper — clears in-memory client registry. */
  static reset() {
    clients.clear();
  }
}
