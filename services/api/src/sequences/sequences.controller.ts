/**
 * Sequences controller — the drip builder's REST surface (A2.8).
 *   POST   /enterprise/:eid/sequences             create
 *   GET    /enterprise/:eid/sequences             list
 *   GET    /enterprise/:eid/sequences/:id         one
 *   PATCH  /enterprise/:eid/sequences/:id         update (steps replace)
 *   DELETE /enterprise/:eid/sequences/:id         hard delete (cascade runs)
 *   POST   /enterprise/:eid/sequences/:id/start   enroll a lead (runs step 0)
 *   GET    /enterprise/:eid/sequences/:id/runs    run history
 *   POST   /enterprise/:eid/sequences/:id/process force-process due steps now
 *
 * Auth: every route is tenant-scoped through the JWT (req.auth.enterpriseId
 * must match :eid) — same guard style as the automations controller.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthContext } from '../auth/auth.guard.js';
import { SequencesService } from './sequences.service.js';
import type { CreateSequenceDto, UpdateSequenceDto } from './types.js';

function assertTenant(req: FastifyRequest, eid: string): AuthContext {
  const auth = req.auth;
  if (!auth) throw new Error('unauthenticated');
  if (auth.enterpriseId !== eid) throw new Error('enterprise mismatch');
  return auth;
}

function bad(message: string, code = 'VALIDATION_ERROR'): HttpException {
  return new HttpException({ error: { code, message } }, HttpStatus.BAD_REQUEST);
}

function notFound(): HttpException {
  return new HttpException(
    { error: { code: 'SEQUENCE_NOT_FOUND', message: 'Sequence not found' } },
    HttpStatus.NOT_FOUND,
  );
}

@Controller('enterprise/:eid/sequences')
export class SequencesController {
  constructor(@Inject(SequencesService) private readonly service: SequencesService) {}

  @Post()
  async create(@Param('eid') eid: string, @Req() req: FastifyRequest, @Body() dto: CreateSequenceDto) {
    assertTenant(req, eid);
    if (!dto?.name || typeof dto.name !== 'string') {
      throw bad('name is required');
    }
    if (!Array.isArray(dto.steps) || dto.steps.length === 0) {
      throw bad('at least one step is required');
    }
    const auth = req.auth;
    const seq = await this.service.createSequence(eid, dto, auth?.userId);
    return { data: seq, id: seq.id };
  }

  @Get()
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const data = await this.service.listSequences(eid);
    return { data };
  }

  @Get(':id')
  async getOne(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const seq = await this.service.getSequence(eid, id);
    if (!seq) throw notFound();
    return { data: seq };
  }

  @Get(':id/runs')
  async runs(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const seq = await this.service.getSequence(eid, id);
    if (!seq) throw notFound();
    const runs = await this.service.listRuns(eid, id);
    return { data: runs };
  }

  @Patch(':id')
  async update(
    @Param('eid') eid: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() dto: UpdateSequenceDto,
  ) {
    assertTenant(req, eid);
    const auth = req.auth;
    const seq = await this.service.updateSequence(eid, id, dto, auth?.userId);
    if (!seq) throw notFound();
    return { data: seq };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const auth = req.auth;
    const ok = await this.service.deleteSequence(eid, id, auth?.userId);
    if (!ok) throw notFound();
    return { success: true, id };
  }

  /**
   * Enroll a lead: executes step 0 immediately (delayDays 0) and records a
   * sequence_run. Body: { leadId?: string }.
   */
  @Post(':id/start')
  @HttpCode(200)
  async start(
    @Param('eid') eid: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: { leadId?: string } | undefined,
  ) {
    assertTenant(req, eid);
    const run = await this.service.startSequence(eid, id, body?.leadId ?? null);
    if (!run) throw notFound();
    return { runId: run.id, data: run };
  }

  /**
   * Force-process due steps for the sequence's running runs now — the
   * deterministic test hook for the 60s scheduler tick.
   */
  @Post(':id/process')
  @HttpCode(200)
  async process(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const seq = await this.service.getSequence(eid, id);
    if (!seq) throw notFound();
    const result = await this.service.processSequence(eid, id);
    return { processed: result.processed, runs: result.runs };
  }
}
