import type { Consumer, Producer } from "kafkajs";
import { config } from "../../config";
import { logger } from "../../common/logger";
import type { kafkaStatusResponseSchema } from "../../models/schemas/kafka";
import { getKafkaClient, resetKafkaClient } from "./client";
import {
  getLastConsumedMessage,
  handleIncomingMessage,
  resetLastConsumedMessage,
} from "./consumer";

export { getLastConsumedMessage } from "./consumer";

let producer: Producer | null = null;
let consumer: Consumer | null = null;
let started = false;

export function isKafkaEnabled() {
  return config.env.kafka.enabled;
}

export function getKafkaStatus(): typeof kafkaStatusResponseSchema.static {
  return {
    enabled: isKafkaEnabled(),
    topic: config.env.kafka.topic,
    lastConsumed: getLastConsumedMessage(),
  };
}

export async function getKafkaProducer() {
  const client = getKafkaClient();
  if (!client) return null;

  if (!producer) {
    producer = client.producer();
    await producer.connect();
  }

  return producer;
}

export async function startKafka() {
  if (!isKafkaEnabled() || started) return;

  const client = getKafkaClient();
  if (!client) return;

  await getKafkaProducer();

  consumer = client.consumer({ groupId: config.env.kafka.groupId });
  await consumer.connect();
  await consumer.subscribe({
    topic: config.env.kafka.topic,
    fromBeginning: false,
  });

  void consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      await handleIncomingMessage({
        topic,
        partition,
        offset: message.offset,
        key: message.key?.toString(),
        value: message.value?.toString() ?? "",
      });
    },
  });

  started = true;
  logger.info(`Kafka consumer subscribed to topic "${config.env.kafka.topic}"`);
}

export async function stopKafka() {
  if (!started) return;

  await consumer?.disconnect();
  consumer = null;

  await producer?.disconnect();
  producer = null;

  resetLastConsumedMessage();
  resetKafkaClient();
  started = false;

  logger.info("Kafka disconnected");
}
