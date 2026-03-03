import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageBrokerAdapter, OutboxMessage, OutboxStorageAdapter } from '../src/index.js';
import { OutboxProcessor } from '../src/index.js';

describe('OutboxProcessor', () => {
  let mockStorage: import('vitest').Mocked<OutboxStorageAdapter>;
  let mockBroker: import('vitest').Mocked<MessageBrokerAdapter>;
  let processor: OutboxProcessor;

  beforeEach(() => {
    // Criamos Mocks dos nossos adaptadores
    mockStorage = {
      save: vi.fn(),
      fetchPending: vi.fn(),
      markAsProcessed: vi.fn(),
      markAsFailed: vi.fn(),
    };

    mockBroker = {
      publish: vi.fn(),
    };

    processor = new OutboxProcessor(mockStorage, mockBroker, { batchSize: 10 });
  });

  it('should process pending messages successfully', async () => {
    const fakeMessage: OutboxMessage = {
      id: 'msg-1',
      type: 'user.created',
      topic: 'users',
      payload: { id: 1 },
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Simulamos que o banco retornou 1 mensagem
    mockStorage.fetchPending.mockResolvedValue([fakeMessage]);
    mockBroker.publish.mockResolvedValue(undefined);

    await processor.processPendingMessages();

    // Verificações estritas

    expect(mockStorage.fetchPending).toHaveBeenCalledWith(10);
    expect(mockBroker.publish).toHaveBeenCalledWith(fakeMessage);
    expect(mockStorage.markAsProcessed).toHaveBeenCalledWith('msg-1');
    expect(mockStorage.markAsFailed).not.toHaveBeenCalled();
  });

  it('should mark messages as failed if broker throws an error', async () => {
    const fakeMessage: OutboxMessage = {
      id: 'msg-2',
      type: 'user.updated',
      topic: 'users',
      payload: { id: 2 },
      status: 'PENDING',
      attempts: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Simulamos que o banco retornou 1 mensagem
    mockStorage.fetchPending.mockResolvedValue([fakeMessage]);
    mockBroker.publish.mockRejectedValue(new Error('Broker is down'));

    await processor.processPendingMessages();

    expect(mockBroker.publish).toHaveBeenCalledWith(fakeMessage);
    expect(mockStorage.markAsProcessed).not.toHaveBeenCalled();
    expect(mockStorage.markAsFailed).toHaveBeenCalledWith(
      'msg-2',
      expect.stringContaining('Broker is down'),
    );
  });
});
