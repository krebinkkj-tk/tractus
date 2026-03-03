import { PrismaPg } from '@prisma/adapter-pg';
import { KafkaBrokerAdapter } from '@tractus/broker-kafka';
import { OutboxProcessor } from '@tractus/core';
import { PrismaOutboxAdapter } from '@tractus/outbox-prisma';
import { Kafka } from 'kafkajs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import defineConfig from '../prisma.config.js';
import { PrismaClient } from './generated/client.js';

describe('End-to-End: Tractus Outbox Flow', () => {
  let prisma: PrismaClient;
  let kafka: Kafka;
  let processor: OutboxProcessor;
  const receivedMessages: any[] = [];

  const testTopic = 'e2e-orders-topic';

  beforeAll(async () => {
    // 1. Inicializar Prisma
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: defineConfig.datasource?.url }),
    });
    await prisma.$connect();

    // Limpar a tabela antes de começar
    await prisma.tractusOutbox.deleteMany();

    // 2. Inicializar Kafka (Redpanda)
    kafka = new Kafka({
      clientId: 'tractus-e2e',
      brokers: ['localhost:9092'],
    });

    // 3. Configurar Consumidor de Teste
    const consumer = kafka.consumer({ groupId: 'test-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: testTopic, fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ message }) => {
        receivedMessages.push({
          key: message.key?.toString(),
          value: message.value ? JSON.parse(message.value.toString()) : null,
          headers: message.headers,
        });
      },
    });

    // 4. Configurar Tractus
    const producer = kafka.producer();
    await producer.connect();

    const storageAdapter = new PrismaOutboxAdapter(prisma);
    const brokerAdapter = new KafkaBrokerAdapter(producer);

    processor = new OutboxProcessor(storageAdapter, brokerAdapter, {
      batchSize: 10,
      pollingInterval: 500, // Polling rápido para o teste
    });

    processor.start();
  });

  afterAll(async () => {
    processor.stop();
    await prisma.$disconnect();
    // Em um cenário real também desconectaríamos o Kafka,
    // mas o Vitest encerra o processo de qualquer forma.
  });

  it('should process a database message and deliver it to Kafka', async () => {
    // 1. Inserir mensagem no banco (Simulando a aplicação do utilizador)
    const outboxRecord = await prisma.tractusOutbox.create({
      data: {
        type: 'order.created',
        topic: testTopic,
        payload: { orderId: 999, amount: 250 },
        status: 'PENDING',
        attempts: 0,
      },
    });

    // 2. Aguardar o tempo do polling + processamento + entrega no kafka
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 3. Validar estado no banco de dados
    const updatedRecord = await prisma.tractusOutbox.findUnique({
      where: { id: outboxRecord.id },
    });

    expect(updatedRecord?.status).toBe('PROCESSED');

    // 4. Validar chegada no Kafka
    expect(receivedMessages.length).toBeGreaterThanOrEqual(1);
    const kafkaMsg = receivedMessages.find((m) => m.key === outboxRecord.id);

    expect(kafkaMsg).toBeDefined();
    expect(kafkaMsg.value).toEqual({ orderId: 999, amount: 250 });
    expect(kafkaMsg.headers['x-tractus-type'].toString()).toBe('order.created');
  }, 10000); // Aumentar o timeout do teste para 10 segundos
});
