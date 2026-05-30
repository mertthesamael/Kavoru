import Elysia from "elysia";
import {
  wsMessageSchema,
  wsQuerySchema,
} from "../../models/schemas/realtime";
import { RealtimeService } from "./service";

export default new Elysia({
  name: "realtime",
  prefix: "/realtime",
  tags: ["WebSocket"],
})
  .get("/stats", () => RealtimeService.stats())
  .ws("/ws", {
    body: wsMessageSchema,
    query: wsQuerySchema,
    open(ws) {
      RealtimeService.register(ws, ws.data.query.room);
    },
    message(ws, payload) {
      RealtimeService.handleMessage(ws, payload, ws.data.query.room);
    },
    close(ws) {
      RealtimeService.unregister(ws);
    },
  });
