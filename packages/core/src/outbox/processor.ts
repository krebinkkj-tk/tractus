import { clearTimeout } from 'node:timers';
import type { MessageBrokerAdapter, OutboxProcessorConfig, OutboxStorageAdapter } from './types.js';

export class OutboxProcessor {
  private isRunning = false;
  private timer?: NodeJS.Timeout;
  private readonly batchSize: number;
  private readonly pollingInterval: number;
  private readonly maxRetries: number;

  constructor(
    private readonly storage: OutboxStorageAdapter,
    private readonly broker: MessageBrokerAdapter,
    config: OutboxProcessorConfig = {},
  ) {
    this.batchSize = config.batchSize ?? 50;
    this.pollingInterval = config.pollingInterval ?? 2000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextTick();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * Processa o lote atual de mensagens pendentes.
   * Exposto publicamente para testes ou processamento manual/serverless.
   */
  public async processPendingMessages(): Promise<void> {
    const messages = await this.storage.fetchPending(this.batchSize);

    if (messages.length === 0) return;

    // Processamento em paralelo com Promise.allSettled para isolar falhas
    const _results = await Promise.allSettled(
      messages.map(async (message) => {
        try {
          await this.broker.publish(message);
          await this.storage.markAsProcessed(message.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const nextAttempt = message.attempts + 1;

          if (nextAttempt >= this.maxRetries) {
            await this.storage.markAsFailed(message.id, errorMessage);
          } else {
            await this.storage.markAsFailed(
              message.id,
              `Attempt ${nextAttempt} failed: ${errorMessage}`,
            );
          }
          throw error; // Re-throw para allSettled capturar como rejected
        }
      }),
    );
  }

  private scheduleNextTick(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      try {
        await this.processPendingMessages();
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: bypass
        console.error('[Tractus] OutboxProcessor error during tick:', error);
      } finally {
        this.scheduleNextTick();
      }
    }, this.pollingInterval);
  }
}
