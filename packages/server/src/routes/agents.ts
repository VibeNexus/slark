import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { ReasoningEffort, Runtime } from '@slark/shared';
import { agentRepo, activityRepo } from '../db/repos.js';
import { agentWorkspacePath } from '../config.js';

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

    // 创建 workspace 目录（v0 兼容：若 agent 绑定了 Project，Project.workspace_path 会接管 cwd；
    //                   但 ~/.slark/agents/{id} 仍保留作为 fallback 目录，D-8 最终废除在 CP6+）
    try {
      mkdirSync(agentWorkspacePath(agent.id), { recursive: true });
    } catch (e) {
      req.log.warn({ err: e }, 'failed to create agent workspace');
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

  // 启动（stopped → idle）
  app.post('/api/agents/:id/start', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    agentRepo.updateStatus(db, id, 'idle');
    return { ok: true, status: 'idle' };
  });

  // 停止
  app.post('/api/agents/:id/stop', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    agentRepo.updateStatus(db, id, 'stopped');
    // TODO MVP-4: 同时 kill 正在跑的 CLI 进程
    return { ok: true, status: 'stopped' };
  });

  // 重启（stop + 清 workspace + start）
  app.post('/api/agents/:id/restart', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    agentRepo.updateStatus(db, id, 'idle');
    try {
      rmSync(agentWorkspacePath(id), { recursive: true, force: true });
      mkdirSync(agentWorkspacePath(id), { recursive: true });
    } catch (e) {
      req.log.warn({ err: e }, 'failed to reset workspace');
    }
    return { ok: true, status: 'idle' };
  });

  // Activity 日志
  app.get('/api/agents/:id/activity', async (req) => {
    const { id } = req.params as { id: string };
    const query = req.query as { limit?: string; before?: string };
    const limit = query.limit ? Math.min(200, Number(query.limit)) : 50;
    const before = query.before ? Number(query.before) : undefined;
    return activityRepo.list(db, id, limit, before);
  });

  // Workspace 文件树（浅层扫描，最多 3 层）
  app.get('/api/agents/:id/workspace', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = agentRepo.getById(db, id);
    if (!a) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    const root = agentWorkspacePath(id);
    try {
      return {
        path: root,
        tree: listDir(root, 3),
      };
    } catch (e) {
      reply.code(200);
      return { path: root, tree: [], error: (e as Error).message };
    }
  });
}

interface FileNode {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

function listDir(dir: string, depth: number): FileNode[] {
  if (depth <= 0) return [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const result: FileNode[] = [];
  for (const name of entries.sort()) {
    if (name.startsWith('.') && name !== '.well-known') continue;
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        result.push({
          name,
          type: 'dir',
          children: listDir(full, depth - 1),
        });
      } else {
        result.push({ name, type: 'file', size: st.size });
      }
    } catch {
      // ignore
    }
  }
  return result;
}
