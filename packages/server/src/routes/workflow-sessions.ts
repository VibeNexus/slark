/**
 * Workflow Sessions REST API（Sprint 7 / Facilitator）
 *
 * Endpoints:
 *   GET  /api/projects/:id/workflow-sessions               列出该 project 的所有 session
 *   POST /api/projects/:id/workflow-sessions               启动新 session（异步跑 Facilitator）
 *   GET  /api/workflow-sessions/:id                        详情
 *   POST /api/workflow-sessions/:id/approve                Approve：把 draft_yaml 写到 workflows 表
 *     body: { name?, trigger_command? } 可 override；默认从 YAML 顶部解析
 *   POST /api/workflow-sessions/:id/reject                 标 rejected
 *   POST /api/workflow-sessions/:id/archive                标 archived
 */

import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { LOCAL_USER_ID } from '@slark/shared';
import {
  agentRepo,
  projectRepo,
  workflowRepo,
  workflowSessionRepo,
} from '../db/repos.js';
import { runFacilitator } from '../system-agents/facilitator.js';
import { parseWorkflowYaml, WorkflowYamlError } from '../workflows/yaml-parser.js';
import { deriveResponsibilitiesForWorkflow } from '../workflows/derive-responsibilities.js';

export async function workflowSessionRoutes(
  app: FastifyInstance,
  db: Database,
): Promise<void> {
  app.get('/api/projects/:id/workflow-sessions', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!projectRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'project not found' };
    }
    return workflowSessionRepo.listByProject(db, id);
  });

  app.post('/api/projects/:id/workflow-sessions', async (req, reply) => {
    const { id: projectId } = req.params as { id: string };
    const project = projectRepo.getById(db, projectId);
    if (!project) {
      reply.code(404);
      return { error: 'project not found' };
    }
    const body = req.body as { goal_input?: string };
    if (!body?.goal_input || typeof body.goal_input !== 'string') {
      reply.code(400);
      return { error: 'goal_input is required' };
    }

    const session = workflowSessionRepo.create(db, {
      project_id: projectId,
      goal_input: body.goal_input.trim(),
      started_by: LOCAL_USER_ID,
    });

    // 异步跑 Facilitator
    void facilitateInBackground(db, session.id, {
      info: (m) => req.log.info(m),
      warn: (m) => req.log.warn(m),
    }).catch((e: Error) => req.log.warn(`[facilitator] ${e.message}`));

    reply.code(201);
    return session;
  });

  app.get('/api/workflow-sessions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const s = workflowSessionRepo.getById(db, Number(id));
    if (!s) {
      reply.code(404);
      return { error: 'session not found' };
    }
    return s;
  });

  app.post('/api/workflow-sessions/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = workflowSessionRepo.getById(db, Number(id));
    if (!session) {
      reply.code(404);
      return { error: 'session not found' };
    }
    if (session.status !== 'awaiting_approval' || !session.draft_yaml) {
      reply.code(409);
      return { error: `session is ${session.status}; cannot approve` };
    }
    const body = (req.body ?? {}) as {
      name?: string;
      trigger_command?: string;
    };

    let definition;
    try {
      definition = parseWorkflowYaml(session.draft_yaml);
    } catch (e) {
      const msg = e instanceof WorkflowYamlError ? e.message : (e as Error).message;
      reply.code(400);
      return { error: `draft YAML invalid: ${msg}` };
    }

    const trigger = body.trigger_command ?? definition.trigger.command;
    const name = body.name ?? definition.name;

    // 检查 trigger 唯一
    const conflict = workflowRepo.getByTrigger(db, session.project_id, trigger);
    if (conflict) {
      reply.code(409);
      return {
        error: `trigger_command "${trigger}" already used by workflow "${conflict.name}"`,
      };
    }

    const wf = workflowRepo.create(db, {
      project_id: session.project_id,
      name,
      description: definition.description ?? null,
      trigger_command: trigger,
      definition_yaml: session.draft_yaml,
      source: 'user',
    });
    try {
      deriveResponsibilitiesForWorkflow(db, wf.id);
    } catch (e) {
      req.log.warn(`[workflow-session] derive failed: ${(e as Error).message}`);
    }

    const updated = workflowSessionRepo.update(db, session.id, {
      status: 'approved',
      workflow_id: wf.id,
      ended: true,
    });
    return { session: updated, workflow: wf };
  });

  app.post('/api/workflow-sessions/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = workflowSessionRepo.getById(db, Number(id));
    if (!session) {
      reply.code(404);
      return { error: 'session not found' };
    }
    if (session.status === 'approved' || session.status === 'archived') {
      reply.code(409);
      return { error: `session is ${session.status}; cannot reject` };
    }
    return workflowSessionRepo.update(db, session.id, { status: 'rejected', ended: true });
  });

  app.post('/api/workflow-sessions/:id/archive', async (req, reply) => {
    const { id } = req.params as { id: string };
    const session = workflowSessionRepo.getById(db, Number(id));
    if (!session) {
      reply.code(404);
      return { error: 'session not found' };
    }
    return workflowSessionRepo.update(db, session.id, { status: 'archived', ended: true });
  });
}

// =============================================================================
// 后台跑 Facilitator
// =============================================================================

async function facilitateInBackground(
  db: Database,
  sessionId: number,
  logger: { info: (m: string) => void; warn: (m: string) => void },
): Promise<void> {
  const session = workflowSessionRepo.getById(db, sessionId);
  if (!session || session.status !== 'drafting') return;
  const project = projectRepo.getById(db, session.project_id);
  if (!project) {
    workflowSessionRepo.update(db, sessionId, {
      status: 'failed',
      fallback_reason: 'project not found',
      ended: true,
    });
    return;
  }
  const agents = agentRepo.listByProject(db, session.project_id);
  const out = await runFacilitator(
    { project, agents, goal_input: session.goal_input },
    logger,
  );
  if (!out.ok) {
    workflowSessionRepo.update(db, sessionId, {
      status: 'failed',
      fallback_reason: out.fallback_reason ?? 'unknown',
      ended: true,
    });
    return;
  }
  workflowSessionRepo.update(db, sessionId, {
    status: 'awaiting_approval',
    draft_yaml: out.yaml ?? '',
    rationale: out.rationale ?? null,
  });
}
