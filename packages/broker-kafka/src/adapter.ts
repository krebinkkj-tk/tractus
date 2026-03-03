import type { MessageBrokerAdapter, OutboxMessage } from '@tractus/core';
import type { Producer } from 'kafkajs';

export interface MinimalKafkaProducer {
  send: Producer['send'];
}

export class KafkaBrokerAdapter implements MessageBrokerAdapter {
  constructor(private readonly producer: MinimalKafkaProducer) {}

  async publish(message: OutboxMessage): Promise<void> {
    const payloadBuffer = Buffer.from(JSON.stringify(message.payload));

    await this.producer.send({
      topic: message.topic,
      messages: [
        {
          key: message.id, // Garante que a mesma mensagem vá sempre para a mesma partição
          value: payloadBuffer,
          headers: {
            'x-tractus-id': message.id,
            'x-tractus-type': message.type,
            'x-tractus-attempts': String(message.attempts),
          },
        },
      ],
    });
  }
}
