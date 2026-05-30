import { Kafka } from "kafkajs";
import { config } from "../../config";

let kafka: Kafka | null = null;

export function getKafkaClient() {
  if (!config.env.kafka.enabled) return null;

  if (!kafka) {
    kafka = new Kafka({
      clientId: config.env.kafka.clientId,
      brokers: config.env.kafka.brokers,
    });
  }

  return kafka;
}

export function resetKafkaClient() {
  kafka = null;
}
