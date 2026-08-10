/**
 * Workforce module (ByteCodeEMS port) — attendance, EOD, tasks, departments,
 * metrics, reports/exports, and device-side call tracking. Follows the
 * TelephonyModule convention: feature controllers live here, AppModule just
 * imports the module (DatabaseModule/AuditModule/AuthModule are @Global).
 */
import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller.js';
import { EodController } from './eod.controller.js';
import { TasksController } from './tasks.controller.js';
import { DepartmentsController } from './departments.controller.js';
import { MetricsController } from './metrics.controller.js';
import { ReportsController } from './reports.controller.js';
import { DeviceCallsController } from './device-calls.controller.js';
import { MeController } from './me.controller.js';
import { TeamAdminController } from './team-admin.controller.js';
import { WorkforceService } from './workforce.service.js';
import { WorkforceJobsService } from './system-jobs.js';

@Module({
  controllers: [
    AttendanceController,
    EodController,
    TasksController,
    DepartmentsController,
    MetricsController,
    ReportsController,
    DeviceCallsController,
    MeController,
    TeamAdminController,
  ],
  providers: [WorkforceService, WorkforceJobsService],
  exports: [WorkforceService, WorkforceJobsService],
})
export class WorkforceModule {}
