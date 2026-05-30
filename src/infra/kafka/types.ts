export type KafkaIncomingMessage = {
  topic: string;
  partition: number;
  offset: string;
  key?: string;
  value: string;
};
