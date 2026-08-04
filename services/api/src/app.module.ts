import { Module } from '@nestjs/common';
import { DatabaseModule } from './db/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { MetadataController } from './metadata/metadata.controller.js';
import { AsyncModule } from './async/async.module.js';
import { TeamModule } from './sync/team.module.js';
import { MetaModule } from './sync/meta.module.js';
import { SyncModule } from './sync/sync.module.js';
import { WhatsappModule } from './whatsapp/whatsapp.module.js';
import { TelephonyModule } from './telephony/telephony.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, AsyncModule, TeamModule, MetaModule, SyncModule, WhatsappModule, TelephonyModule],
  controllers: [HealthController, MetadataController],
})
export class AppModule {}