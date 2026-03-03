export type OutboxMessageStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED';

export interface OutboxMessage<TPayload = unknown> {
  /** UUID único da mensagem */
  id: string;
  /** Tipo de evento (ex: 'user:created) */
  type: string;
  /** O payload real que será enviado ao broker */
  payload: TPayload;
  /** Tópico ou destino no broker */
  topic: string;
  /** Status atual da mensagem */
  status: OutboxMessageStatus;
  /** Quantidade de tentativas de envio */
  attempts: number;
  /** Erro da ultima tentativa, se houver */
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
/**
 * Interface que todos os adaptadores de banco de dados (Prisma, Drizzle, etc.)
 * devem implementar para persistir e buscar mensagens.
 */
export interface OutboxStorageAdapter {
  save(
    message: Omit<OutboxMessage, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'attempts'>,
  ): Promise<OutboxMessage>;
  fetchPending(limit: number): Promise<OutboxMessage[]>;
  markAsProcessed(id: string): Promise<void>;
  markAsFailed(id: string, error: string): Promise<void>;
}

/**
 * Interface que todos os adaptadores de mensageria (Kafka,RabbitMQ, Redis)
 * devem implementar para publicar mensagens.
 */
export interface MessageBrokerAdapter {
  publish(message: OutboxMessage): Promise<void>;
}

export interface OutboxProcessorConfig {
  /** Quantidade máxima de mensagens a processar por ciclo */
  batchSize?: number;
  /** Intervalo em milissegundos entre as verificações no banco */
  pollingInterval?: number;
  /** Número máximo de tentativas antes de marcar como FAILED */
  maxRetries?: number;
}
