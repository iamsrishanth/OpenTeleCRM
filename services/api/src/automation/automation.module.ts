/**
 * Automation module — P4 in-process rule engine (A4.x).
 *
 * Wires:
 *   - AutomationService     CRUD + run + step records + in-memory cache
 *   - ActionDispatcher      action executors (assign_lead / create_callback / …)
 *   - AutomationScheduler   60s tick that fires scheduled rules
 *   - RulesController       REST CRUD on /enterprise/:eid/automations
 *   - DistributionController POST /enterprise/:eid/lead/:leadId/distribute
 *   - WebhookController     POST /webhook/:slug (public, no auth)
 */
import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../db/database.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ActionDispatcher, evaluateActionConfig } from './dispatcher.js';
import { AutomationService } from './automation.service.js';
import { AutomationScheduler } from './scheduler.js';
import { RulesController } from './rules.controller.js';
import { DistributionController } from './distribution.controller.js';
import { WebhookController } from './webhook.controller.js';

export { AutomationService };
export { ActionDispatcher, evaluateActionConfig };
export type { AutomationEvent, AutomationRule, AutomationRun } from './types.js';

@Global()
@Module({
  imports: [DatabaseModule, AuditModule],
  providers: [AutomationService, ActionDispatcher, AutomationScheduler],
  controllers: [RulesController, DistributionController, WebhookController],
  exports: [AutomationService, ActionDispatcher],
})
export class AutomationModule {}
