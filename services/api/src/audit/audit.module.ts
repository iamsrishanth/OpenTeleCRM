import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';

/**
 * Audit write path (B5). @Global so every controller module can inject
 * AuditService without per-module imports — same pattern as DatabaseModule.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
