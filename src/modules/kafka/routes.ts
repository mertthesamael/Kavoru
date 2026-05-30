import Elysia from "elysia";
import { getKafkaStatus } from "../../infra/kafka";
import { publishMessageSchema } from "../../models/schemas/kafka";
import { KafkaService } from "./service";

export default new Elysia({
  name: "kafka",
  prefix: "/kafka",
  tags: ["Kafka"],
})
  .get("/status", () => getKafkaStatus())
  .post("/publish", ({ body }) => KafkaService.publish(body.value, body.key), {
    body: publishMessageSchema,
  });
