/**
 * Rules CRUD controller — the workflow builder's REST surface (A4.1).
 *   POST   /enterprise/:eid/automations       create
 *   GET    /enterprise/:eid/automations       list
 *   GET    /enterprise/:eid/automations/:id   one
 *   PATCH  /enterprise/:eid/automations/:id   update
 *   DELETE /enterprise/:eid/automations/:id   hard delete
 *   POST   /enterprise/:eid/automations/:id/test  fire a synthetic run
 *
 * Auth: every route is tenant-scoped through the JWT (req.auth.enterpriseId
 * must match :eid). Hard delete matches the rest of the API's lead/action
 * delete style (the rule + runs + steps are removed in a single cascade).
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
import { AutomationService } from './automation.service.js';
import type { CreateRuleDto, UpdateRuleDto } from './types.js';

function assertTenant(req: FastifyRequest, eid: string): AuthContext {
  const auth = req.auth;
  if (!auth) throw new Error('unauthenticated');
  if (auth.enterpriseId !== eid) throw new Error('enterprise mismatch');
  return auth;
}

function bad(message: string, code = 'VALIDATION_ERROR'): HttpException {
  return new HttpException({ error: { code, message } }, HttpStatus.BAD_REQUEST);
}

@Controller('enterprise/:eid/automations')
export class RulesController {
  constructor(@Inject(AutomationService) private readonly service: AutomationService) {}

  @Post()
  async create(
    @Param('eid') eid: string,
    @Req() req: FastifyRequest,
    @Body() dto: CreateRuleDto,
  ) {
    assertTenant(req, eid);
    if (!dto?.name || typeof dto.name !== 'string') {
      throw bad('name is required');
    }
    if (!dto?.trigger?.kind) {
      throw bad('trigger.kind is required');
    }
    if (!Array.isArray(dto.actions) || dto.actions.length === 0) {
      throw bad('at least one action is required');
    }
    const auth = req.auth;
    const rule = await this.service.createRule(eid, dto, auth?.userId);
    return { data: rule, id: rule.id };
  }

  @Get()
  async list(@Param('eid') eid: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const data = await this.service.listRules(eid);
    return { data };
  }

  @Get(':id')
  async getOne(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const rule = await this.service.getRule(eid, id);
    if (!rule) {
      throw new HttpException(
        { error: { code: 'AUTOMATION_NOT_FOUND', message: 'Rule not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    return { data: rule };
  }

  @Get(':id/runs')
  async runs(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const rule = await this.service.getRule(eid, id);
    if (!rule) {
      throw new HttpException(
        { error: { code: 'AUTOMATION_NOT_FOUND', message: 'Rule not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    const runs = await this.service.listRuns(eid, id);
    return { data: runs };
  }

  @Patch(':id')
  async update(
    @Param('eid') eid: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() dto: UpdateRuleDto,
  ) {
    assertTenant(req, eid);
    const auth = req.auth;
    const rule = await this.service.updateRule(eid, id, dto, auth?.userId);
    if (!rule) {
      throw new HttpException(
        { error: { code: 'AUTOMATION_NOT_FOUND', message: 'Rule not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    return { data: rule };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('eid') eid: string, @Param('id') id: string, @Req() req: FastifyRequest) {
    assertTenant(req, eid);
    const auth = req.auth;
    const ok = await this.service.deleteRule(eid, id, auth?.userId);
    if (!ok) {
      throw new HttpException(
        { error: { code: 'AUTOMATION_NOT_FOUND', message: 'Rule not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true, id };
  }

  @Post(':id/test')
  @HttpCode(200)
  async test(
    @Param('eid') eid: string,
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @Body() body: { payload?: Record<string, unknown> } | undefined,
  ) {
    assertTenant(req, eid);
    const runId = await this.service.testRule(eid, id, body?.payload ?? {});
    if (!runId) {
      throw new HttpException(
        { error: { code: 'AUTOMATION_NOT_FOUND', message: 'Rule not found' } },
        HttpStatus.NOT_FOUND,
      );
    }
    return { runId };
  }
}
