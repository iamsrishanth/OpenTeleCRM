import { Module } from '@nestjs/common';
import { AsyncController } from './async.controller.js';

/**
 * Async API surface (TeleCRM-parity fire-and-forget ingestion).
 * Routes:
 *   POST /autoupdate/v2/enterprise/{eid}/autoupdatelead
 *   GET  /autoupdate/v2/enterprise/{eid}/ingest/:requestId
 */
@Module({
  controllers: [AsyncController],
})
export class AsyncModule {}