/**
 * Tractus Outbox Prima Schema Reference.
 * O consumidor da biblioteca deverá adicionar este modelo ao seu ficheiro schema.prisma.
 * * model TractusOutbox {
 *   id           String      @id @default(uuid())
 *   type         String
 *   topic        String
 *   payload      Json
 *   status       String      @default("PENDING") // PENDING, PROCESSING, PROCESSED, FAILED
 *   attempts     Int         @default(0)
 *   lastError    String?     @db.Text
 *   createdAt    DateTime    @default(now())
 *   updatedAt    Datetime    @updatedAt
 * * @@index([status, createdAt])
 * }
 */
