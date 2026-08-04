import { Module } from '@nestjs/common';
import { TeamController } from './team.controller.js';

/**
 * Sync team surface (TeleCRM parity).
 * Routes:
 *   POST /autoupdate/v2/enterprise/{eid}/teammember/state_change
 *   GET  /autoupdate/v2/enterprise/{eid}/team-members
 *   POST /autoupdate/v2/enterprise/{eid}/team-members
 *   GET  /autoupdate/v2/enterprise/{eid}/team-members/:email
 *   PATCH /autoupdate/v2/enterprise/{eid}/team-members/:email
 */
@Module({
  controllers: [TeamController],
})
export class TeamModule {}