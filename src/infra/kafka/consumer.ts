import { logger } from "../../common/logger";
import type { kafkaStatusResponseSchema } from "../../models/schemas/kafka";
import type { KafkaIncomingMessage } from "./types";

let lastConsumed: typeof kafkaStatusResponseSchema.static.lastConsumed;

export function getLastConsumedMessage() {
  return lastConsumed;
}

export async function handleIncomingMessage(
  message: KafkaIncomingMessage,
): Promise<void> {
  lastConsumed = {
    ...message,
    receivedAt: new Date().toISOString(),
  };

  logger.info("Kafka message consumed", {
    topic: message.topic,
    partition: message.partition,
    offset: message.offset,
    key: message.key,
    value: message.value,
  });
}

export function resetLastConsumedMessage() {
  lastConsumed = undefined;
}
