/**
 * Sequences module — A2.8 drip engine (sequences / drips).
 *
 * Wires:
 *   - SequencesService     CRUD + run cursor + due-step execution
 *   - SequencesController  REST CRUD on /enterprise/:eid/sequences
 *
 * @Global so the AutomationScheduler (automation module) can inject
 * SequencesService for the 60s tick hook. ActionDispatcher comes from the
 * global AutomationModule.
 */
import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { SequencesService } from './sequences.service.js';
import { SequencesController } from './sequences.controller.js';

export { SequencesService };

@Global()
@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [SequencesService],
  controllers: [SequencesController],
  exports: [SequencesService],
})
export class SequencesModule {}
