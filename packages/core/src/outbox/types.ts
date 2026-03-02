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
  attemps: number;
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
