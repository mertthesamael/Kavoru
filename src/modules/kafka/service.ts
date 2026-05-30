import { status } from "elysia";
import { logger } from "../../common/logger";
import { config } from "../../config";
import { getKafkaProducer, isKafkaEnabled } from "../../infra/kafka";
import type { publishMessageResponseSchema } from "../../models/schemas/kafka";

export abstract class KafkaService {
  static async publish(
    value: string,
    key?: string,
  ): Promise<typeof publishMessageResponseSchema.static> {
    if (!isKafkaEnabled()) {
      throw status(503, "Kafka is disabled");
    }

    const producer = await getKafkaProducer();
    if (!producer) {
      throw status(503, "Kafka producer is unavailable");
    }

    const result = await producer.send({
      topic: config.env.kafka.topic,
      messages: [{ key, value }],
    });

    const record = result[0];
    if (!record || record.offset === undefined) {
      throw status(500, "Kafka publish returned no metadata");
    }

    logger.info("Kafka message published", {
      topic: config.env.kafka.topic,
      partition: record.partition,
      offset: record.offset,
    });

    return {
      topic: config.env.kafka.topic,
      partition: record.partition,
      offset: record.offset,
    };
  }
}
