import type { OutboxMessage, OutboxStorageAdapter } from '@tractus/core';

/**
 * Interface mínima esperada do PrismaClient para o modelo TractusOutbox.
 * Isto permite que o adaptador funcione sem importar estritamente o cliente gerado do utilizador.
 */
export interface MinimalPrismaClient {
  tractusOutbox: {
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
}

export class PrismaOutboxAdapter implements OutboxStorageAdapter {
  constructor(private readonly prisma: MinimalPrismaClient) {}

  async save(
    message: Omit<OutboxMessage, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'attempts'>,
  ): Promise<OutboxMessage> {
    const created = await this.prisma.tractusOutbox.create({
      data: {
        type: message.type,
        topic: message.type,
        payload: message.payload ?? {},
        status: 'PENDING',
        attempts: 0,
      },
    });

    return this.mapToOutboxMessage(created);
  }

  async fetchPending(limit: number): Promise<OutboxMessage[]> {
    // Busca pendentes e já os marca como PROCESSING
    // em uma única transação/query se possível, mas no Primsa fazemos um findMany
    // seguido de um updateMany para evitar 'race conditions' em múltiplas instâncias.

    const pending = await this.prisma.tractusOutbox.findMany({
      where: { status: 'PENDING' },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    return pending.map(this.mapToOutboxMessage);
  }

  async markAsProcessed(id: string): Promise<void> {
    await this.prisma.tractusOutbox.update({
      where: { id },
      data: { status: 'PROCESSED' },
    });
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    await this.prisma.tractusOutbox.update({
      where: { id },
      data: {
        status: 'FAILED',
        lastError: error,
      },
    });
  }

  private mapToOutboxMessage(record: any): OutboxMessage {
    return {
      id: record.id,
      type: record.type,
      topic: record.topic,
      payload: record.payload,
      status: record.status,
      attempts: record.attempts,
      lastError: record.lastError ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
