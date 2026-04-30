/**
 * Workflows REST API（Sprint 2 CP1）
 *
 * 对齐：
 *   - docs/product-brief.md §D-4
 *   - docs/technical-decisions.md D-16
 *   - PLAN.md Sprint 2 §2.1 / §2.2
 *
 * Endpoints:
 *   GET    /api/projects/:id/workflows                列出该 project 的所有 workflows
 *   POST   /api/projects/:id/workflows                创建 workflow（YAML 由调用方提供）
 *   GET    /api/workflows/:id                         详情
 *   PATCH  /api/workflows/:id                         更新（name / description / trigger_command / definition_yaml）
 *   DELETE /api/workflows/:id                         删除
 *   GET    /api/workflows/:id/runs                    该 workflow 的执行历史
 *   GET    /api/workflow-runs/:id                     单次 run 详情
 *   POST   /api/workflow-runs/:id/abort               用户终止 run
 *   GET    /api/channels/:id/active-workflow-run      Channel 内当前活跃 run（thread 进度条）
 *
 * 注：runner 启动逻辑（POST start）由 MessageRouter 通过 /command 触发，本路由不暴露
 *     直接 start 端点（避免绕过指令防护）。
 */

import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import {
  channelRepo,
  projectRepo,
  responsibilityRepo,
  workflowRepo,
  workflowRunRepo,
} from '../db/repos.js';
import { parseWorkflowYaml, WorkflowYamlError } from '../workflows/yaml-parser.js';
import { abortWorkflowRun } from '../workflows/runner.js';
import { deriveResponsibilitiesForWorkflow } from '../workflows/derive-responsibilities.js';

const COMMAND_RE = /^\/[a-z][a-z0-9-]*$/;

export async function workflowRoutes(app: FastifyInstance, db: Database): Promise<void> {
  // 列出 project 的 workflows
  app.get('/api/projects/:id/workflows', async (req, reply) => {
    const { id } = req.params as { id: string };
    const project = projectRepo.getById(db, id);
    if (!project) {
      reply.code(404);
      return { error: 'project not found' };
    }
    return workflowRepo.listByProject(db, id);
  });

  // 创建 workflow
  app.post('/api/projects/:id/workflows', async (req, reply) => {
    const { id: projectId } = req.params as { id: string };
    const project = projectRepo.getById(db, projectId);
    if (!project) {
      reply.code(404);
      return { error: 'project not found' };
    }

    const body = req.body as {
      name?: string;
      description?: string | null;
      trigger_command?: string;
      definition_yaml?: string;
    };

    if (!body?.name || typeof body.name !== 'string') {
      reply.code(400);
      return { error: 'name is required' };
    }
    if (!body.trigger_command || typeof body.trigger_command !== 'string') {
      reply.code(400);
      return { error: 'trigger_command is required (e.g. "/new-feature")' };
    }
    if (!COMMAND_RE.test(body.trigger_command)) {
      reply.code(400);
      return {
        error:
          'trigger_command must match /^\\/[a-z][a-z0-9-]*$/ (e.g. "/new-feature")',
      };
    }
    if (!body.definition_yaml || typeof body.definition_yaml !== 'string') {
      reply.code(400);
      return { error: 'definition_yaml is required' };
    }

    // 解析 + 校验 YAML
    let definition;
    try {
      definition = parseWorkflowYaml(body.definition_yaml);
    } catch (e) {
      if (e instanceof WorkflowYamlError) {
        reply.code(400);
        return { error: `invalid YAML: ${e.message}` };
      }
      throw e;
    }

    // YAML 内 trigger.command 要与 body.trigger_command 一致
    if (definition.trigger.command !== body.trigger_command) {
      reply.code(400);
      return {
        error: `trigger_command mismatch: body says "${body.trigger_command}" but YAML says "${definition.trigger.command}"`,
      };
    }

    // 同 project 内 trigger_command 唯一
    const existing = workflowRepo.getByTrigger(db, projectId, body.trigger_command);
    if (existing) {
      reply.code(409);
      return {
        error: `trigger_command "${body.trigger_command}" already used by workflow "${existing.name}" in this project`,
      };
    }

    const wf = workflowRepo.create(db, {
      project_id: projectId,
      name: body.name,
      description: body.description ?? null,
      trigger_command: body.trigger_command,
      definition_yaml: body.definition_yaml,
      source: 'user',
    });

    // CP1：自动 derive responsibilities
    try {
      const res = deriveResponsibilitiesForWorkflow(db, wf.id);
      if (res.unresolved.length > 0) {
        req.log.warn(
          { workflow: wf.name, unresolved: res.unresolved },
          '[workflows] derived responsibilities have unresolved agents',
        );
      }
    } catch (e) {
      req.log.warn(
        { err: e, workflow: wf.name },
        '[workflows] failed to derive responsibilities',
      );
    }

    reply.code(201);
    return wf;
  });

  // 详情
  app.get('/api/workflows/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = workflowRepo.getById(db, id);
    if (!wf) {
      reply.code(404);
      return { error: 'workflow not found' };
    }
    return wf;
  });

  // 更新
  app.patch('/api/workflows/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = workflowRepo.getById(db, id);
    if (!wf) {
      reply.code(404);
      return { error: 'workflow not found' };
    }
    const body = req.body as Partial<{
      name: string;
      description: string | null;
      trigger_command: string;
      definition_yaml: string;
    }>;

    if (body.trigger_command !== undefined && !COMMAND_RE.test(body.trigger_command)) {
      reply.code(400);
      return {
        error:
          'trigger_command must match /^\\/[a-z][a-z0-9-]*$/ (e.g. "/new-feature")',
      };
    }

    if (body.definition_yaml !== undefined) {
      try {
        const def = parseWorkflowYaml(body.definition_yaml);
        const triggerCmd = body.trigger_command ?? wf.trigger_command;
        if (def.trigger.command !== triggerCmd) {
          reply.code(400);
          return {
            error: `trigger_command mismatch: ${triggerCmd} vs YAML ${def.trigger.command}`,
          };
        }
      } catch (e) {
        if (e instanceof WorkflowYamlError) {
          reply.code(400);
          return { error: `invalid YAML: ${e.message}` };
        }
        throw e;
      }
    }

    if (body.trigger_command !== undefined && body.trigger_command !== wf.trigger_command) {
      const conflict = workflowRepo.getByTrigger(db, wf.project_id, body.trigger_command);
      if (conflict && conflict.id !== id) {
        reply.code(409);
        return {
          error: `trigger_command "${body.trigger_command}" already used by another workflow`,
        };
      }
    }

    const updated = workflowRepo.update(db, id, body);

    // CP1：YAML 变化时重新 derive responsibilities
    if (updated && body.definition_yaml !== undefined) {
      try {
        deriveResponsibilitiesForWorkflow(db, updated.id);
      } catch (e) {
        req.log.warn(
          { err: e, workflow: updated.name },
          '[workflows] failed to re-derive responsibilities on update',
        );
      }
    }

    return updated;
  });

  // 删除
  app.delete('/api/workflows/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = workflowRepo.getById(db, id);
    if (!wf) {
      reply.code(404);
      return { error: 'workflow not found' };
    }
    workflowRepo.remove(db, id);
    reply.code(204);
  });

  // 该 workflow 的执行历史
  app.get('/api/workflows/:id/runs', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = workflowRepo.getById(db, id);
    if (!wf) {
      reply.code(404);
      return { error: 'workflow not found' };
    }
    return workflowRunRepo.listByWorkflow(db, id);
  });

  // 该 workflow 的责任连接（CP1）
  app.get('/api/workflows/:id/responsibilities', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wf = workflowRepo.getById(db, id);
    if (!wf) {
      reply.code(404);
      return { error: 'workflow not found' };
    }
    return responsibilityRepo.listByWorkflow(db, id);
  });

  // 单次 run 详情
  app.get('/api/workflow-runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const run = workflowRunRepo.getById(db, Number(id));
    if (!run) {
      reply.code(404);
      return { error: 'workflow run not found' };
    }
    const wf = workflowRepo.getById(db, run.workflow_id);
    return { ...run, workflow: wf };
  });

  // Abort run
  app.post('/api/workflow-runs/:id/abort', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { reason?: string };
    const runId = Number(id);
    const run = workflowRunRepo.getById(db, runId);
    if (!run) {
      reply.code(404);
      return { error: 'workflow run not found' };
    }
    if (run.status !== 'running' && run.status !== 'awaiting_approval') {
      reply.code(409);
      return { error: `run is already ${run.status}` };
    }
    abortWorkflowRun(db, runId, body.reason ?? 'aborted by user');
    return workflowRunRepo.getById(db, runId);
  });

  // Channel 内当前活跃 run（前端 Thread 顶部进度条用）
  app.get('/api/channels/:id/active-workflow-run', async (req, reply) => {
    const { id } = req.params as { id: string };
    const channel = channelRepo.getById(db, id);
    if (!channel) {
      reply.code(404);
      return { error: 'channel not found' };
    }
    const query = req.query as { thread_id?: string };
    const run = workflowRunRepo.getActive(db, id, query.thread_id ?? null);
    if (!run) return { run: null };
    const wf = workflowRepo.getById(db, run.workflow_id);
    return { run: { ...run, workflow: wf } };
  });
}
