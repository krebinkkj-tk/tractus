import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type MinimalPrismaClient, PrismaOutboxAdapter } from '../src/index.js';

describe('PrismaOutboxAdapter', () => {
  let mockPrisma: import('vitest').Mocked<MinimalPrismaClient>;
  let adapter: PrismaOutboxAdapter;

  beforeEach(() => {
    mockPrisma = {
      tractusOutbox: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    adapter = new PrismaOutboxAdapter(mockPrisma);
  });

  it('should fetch pending messages correctly', async () => {
    const fakeRecord = {
      id: 'uuid-1',
      type: 'order.created',
      topic: 'orders-topic',
      payload: { orderId: 123 },
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
      updateAt: new Date(),
    };

    // @ts-expect-error - ignorando a tipagem estrita para o mock
    mockPrisma.tractusOutbox.findMany.mockResolvedValue([fakeRecord]);

    const result = await adapter.fetchPending(10);

    expect(mockPrisma.tractusOutbox.findMany).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uuid-1');
  });

  it('should mark message as processed', async () => {
    // @ts-expect-error
    mockPrisma.tractusOutbox.update.mockResolvedValue([]);

    await adapter.markAsProcessed('uuid-1');
    expect(mockPrisma.tractusOutbox.update).toHaveBeenCalledWith({
      where: { id: 'uuid-1' },
      data: { status: 'PROCESSED' },
    });
  });
});
