import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { ReasoningEffort, Runtime } from '@slark/shared';
import { agentRepo, agentRunRepo, activityRepo, workflowRepo } from '../db/repos.js';
import { deriveResponsibilitiesForWorkflow } from '../workflows/derive-responsibilities.js';

export async function agentRoutes(app: FastifyInstance, db: Database): Promise<void> {
  // 列出 agent；可选 ?project_id= 过滤
  app.get('/api/agents', async (req) => {
    const query = req.query as { project_id?: string };
    if (query.project_id) {
      return agentRepo.listByProject(db, query.project_id);
    }
    return agentRepo.list(db);
  });

  // 创建 agent（v1.0：可带 project_id）
  app.post('/api/agents', async (req, reply) => {
    const body = req.body as {
      name: string;
      description?: string | null;
      runtime: Runtime;
      model?: string | null;
      reasoning?: ReasoningEffort | null;
      env_vars?: Record<string, string>;
      avatar?: string | null;
      project_id?: string | null;
    };
    if (!body?.name || !body?.runtime) {
      reply.code(400);
      return { error: 'name and runtime are required' };
    }
    if (agentRepo.getByName(db, body.name)) {
      reply.code(409);
      return { error: `agent with name "${body.name}" already exists` };
    }

    const agent = agentRepo.create(db, body);

    // CP8.5：D-8 v1.0 修订后 agent 不再有独立 workspace 目录。
    // Agent cwd 取自 channel 所属 Project 的 workspace_path。

    // Sprint 3 CP1：新 agent 加入 project 后，重新 derive 该 project 内 workflow 的 responsibilities。
    // 让原 'unresolved:<name>' 占位升级为真实 agent_id（典型场景：Create Project 向导先建 workflow
    // 再批量建 agent，此时 derive 需要在 agent 创建后重跑）。
    if (agent.project_id) {
      const wfs = workflowRepo.listByProject(db, agent.project_id);
      for (const wf of wfs) {
        try {
          deriveResponsibilitiesForWorkflow(db, wf.id);
        } catch (e) {
          req.log.warn(
            { err: e, workflow: wf.name, agent: agent.name },
            '[workflows] failed to re-derive after agent create',
          );
        }
      }
    }

    reply.code(201);
    return agent;
  });

  // 详情
  app.get('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    return a;
  });

  // 更新
  app.patch('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Parameters<typeof agentRepo.update>[2];
    const a = agentRepo.update(db, id, body ?? {});
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    return a;
  });

  // 删除
  app.delete('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    agentRepo.remove(db, id);
    // 可选：保留 workspace 目录作归档（D-8），默认保留
    reply.code(204);
  });

  // 启动 / 停止 / 重启
  // CP8.3：agents.status 已废除，状态从 agent_runs 派生。
  // 这些端点保留接口语义但暂不再写 agents 表；
  // TODO Sprint 2 Workflow Runner：实际 kill agent 的活跃 runs / 处理"全局禁用"语义。
  app.post('/api/agents/:id/start', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    return { ok: true };
  });

  app.post('/api/agents/:id/stop', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    return { ok: true };
  });

  app.post('/api/agents/:id/restart', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    // CP8.5：原 v0 行为是清理 agent workspace 目录；v1.0 已废除独立 workspace。
    // 当前 restart 是 no-op，TODO 改为 kill 该 agent 的活跃 runs。
    return { ok: true };
  });

  // Activity 日志（CP8.4：支持按 channel 过滤）
  app.get('/api/agents/:id/activity', async (req) => {
    const { id } = req.params as { id: string };
    const query = req.query as { limit?: string; before?: string; channel_id?: string };
    const limit = query.limit ? Math.min(200, Number(query.limit)) : 50;
    const before = query.before ? Number(query.before) : undefined;
    return activityRepo.list(db, id, limit, before, query.channel_id);
  });

  // Agent 状态（CP8.2：从 agent_runs 派生 per-channel + anyActive）
  // 取代 v0 的 agents.status 单值字段。
  app.get('/api/agents/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    const activeRuns = agentRunRepo.listActiveForAgent(db, id);
    const perChannel: Record<string, 'thinking' | 'working' | 'error' | 'stopped'> = {};
    for (const run of activeRuns) {
      perChannel[run.channel_id] = run.status;
    }
    return {
      agent_id: id,
      per_channel: perChannel,
      any_active: activeRuns.length > 0,
    };
  });

  // CP8.5：GET /api/agents/:id/workspace 已删除（D-8 v1.0 修订：agent 无独立 workspace）。
  // 旧客户端调用会得到 404 not found（route 不存在），属期望行为。
}
