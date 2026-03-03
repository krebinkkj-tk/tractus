import type { OutboxMessage } from '@tractus/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KafkaBrokerAdapter, type MinimalKafkaProducer } from '../src/adapter.js';

describe('KafkaBrokerAdapter', () => {
  let mockProducer: import('vitest').Mocked<MinimalKafkaProducer>;
  let adapter: KafkaBrokerAdapter;

  beforeEach(() => {
    mockProducer = {
      send: vi.fn(),
    };

    adapter = new KafkaBrokerAdapter(mockProducer);
  });

  it('should format and publish message correctly to Kafka', async () => {
    const fakeMessage: OutboxMessage = {
      id: 'evt-123',
      type: 'payment.processed',
      topic: 'payments-topic',
      payload: { amount: 100, currency: 'EUR' },
      status: 'PROCESSING',
      attempts: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockProducer.send.mockResolvedValue([
      {
        topicName: 'payments-topic',
        partition: 0,
        errorCode: 0,
      },
    ]);

    await adapter.publish(fakeMessage);

    // Verificamos se foi chamado com a estrutura exata exigida pelo KafkaJS
    expect(mockProducer.send).toHaveBeenCalledTimes(1);
    expect(mockProducer.send).toHaveBeenCalledWith({
      topic: 'payments-topic',
      messages: [
        {
          key: 'evt-123',
          value: Buffer.from(JSON.stringify({ amount: 100, currency: 'EUR' })),
          headers: {
            'x-tractus-id': 'evt-123',
            'x-tractus-type': 'payment.processed',
            'x-tractus-attempts': '1',
          },
        },
      ],
    });
  });
});
