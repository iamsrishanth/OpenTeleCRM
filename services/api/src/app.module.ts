import { Module } from '@nestjs/common';
import { DatabaseModule } from './db/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health/health.controller.js';
import { MetadataController } from './metadata/metadata.controller.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HealthController, MetadataController],
})
export class AppModule {}
