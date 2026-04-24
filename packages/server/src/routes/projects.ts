/**
 * Projects REST API（Sprint 1 Checkpoint 2）
 *
 * 对齐：
 *   - docs/product-brief.md §D-2 / §D-3 / §D-14
 *   - docs/technical-decisions.md D-13 / D-14
 *
 * 约束：
 *   - name：URL slug，`^[a-z0-9_-]+$`，唯一
 *   - workspace_path：必填（D-8 无兜底）
 *   - goal：必填，最长 GOAL_MAX_LENGTH 字符（Q-3 决议）
 *
 * 不包含在本 Checkpoint：
 *   - POST /api/projects/:id/suggest-team（Team Architect，见 Checkpoint 4）
 *   - 级联操作 GET /api/projects/:id/channels 暂时放在 channel.project_id 过渡完成后再开
 */

import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { GOAL_MAX_LENGTH } from '@slark/shared';
import { projectRepo } from '../db/repos.js';
import { suggestTeam } from '../system-agents/team-architect.js';

const NAME_SLUG_RE = /^[a-z0-9_-]+$/;

export async function projectRoutes(app: FastifyInstance, db: Database): Promise<void> {
  // 列表
  app.get('/api/projects', async () => projectRepo.list(db));

  // 详情
  app.get('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = projectRepo.getById(db, id);
    if (!p) {
      reply.code(404);
      return { error: 'project not found' };
    }
    return p;
  });

  // 按 name (slug) 查询
  app.get('/api/projects/by-name/:name', async (req, reply) => {
    const { name } = req.params as { name: string };
    const p = projectRepo.getByName(db, name);
    if (!p) {
      reply.code(404);
      return { error: 'project not found' };
    }
    return p;
  });

  // 创建
  app.post('/api/projects', async (req, reply) => {
    const body = req.body as {
      id?: string;
      name?: string;
      display_name?: string | null;
      workspace_path?: string;
      goal?: string;
      team_rules?: string | null;
      color?: string | null;
    };

    // 校验
    if (!body?.name || typeof body.name !== 'string') {
      reply.code(400);
      return { error: 'name is required' };
    }
    if (!NAME_SLUG_RE.test(body.name)) {
      reply.code(400);
      return {
        error: 'name must be URL-safe: lowercase letters, digits, "-" and "_" only',
      };
    }
    if (!body.workspace_path || typeof body.workspace_path !== 'string') {
      reply.code(400);
      return { error: 'workspace_path is required' };
    }
    if (!body.goal || typeof body.goal !== 'string') {
      reply.code(400);
      return { error: 'goal is required' };
    }
    if (body.goal.length > GOAL_MAX_LENGTH) {
      reply.code(400);
      return {
        error: `goal too long: ${body.goal.length} > ${GOAL_MAX_LENGTH} chars`,
      };
    }

    // 重名
    if (projectRepo.getByName(db, body.name)) {
      reply.code(409);
      return { error: `project with name "${body.name}" already exists` };
    }

    const project = projectRepo.create(db, {
      id: body.id,
      name: body.name,
      display_name: body.display_name ?? null,
      workspace_path: body.workspace_path,
      goal: body.goal,
      team_rules: body.team_rules ?? null,
      color: body.color ?? null,
    });
    reply.code(201);
    return project;
  });

  // 更新
  app.patch('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<{
      name: string;
      display_name: string | null;
      workspace_path: string;
      goal: string;
      team_rules: string | null;
      color: string | null;
    }>;

    if (!body) {
      reply.code(400);
      return { error: 'empty body' };
    }
    if (body.name !== undefined && !NAME_SLUG_RE.test(body.name)) {
      reply.code(400);
      return {
        error: 'name must be URL-safe: lowercase letters, digits, "-" and "_" only',
      };
    }
    if (body.goal !== undefined && body.goal.length > GOAL_MAX_LENGTH) {
      reply.code(400);
      return {
        error: `goal too long: ${body.goal.length} > ${GOAL_MAX_LENGTH} chars`,
      };
    }
    // 重名冲突检查
    if (body.name) {
      const existing = projectRepo.getByName(db, body.name);
      if (existing && existing.id !== id) {
        reply.code(409);
        return { error: `project with name "${body.name}" already exists` };
      }
    }

    const p = projectRepo.update(db, id, body);
    if (!p) {
      reply.code(404);
      return { error: 'project not found' };
    }
    return p;
  });

  // 删除（级联 channels / agents / messages / tasks）
  app.delete('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = projectRepo.getById(db, id);
    if (!p) {
      reply.code(404);
      return { error: 'project not found' };
    }
    projectRepo.remove(db, id);
    reply.code(204);
  });

  // -----------------------------------------------------------------------
  // POST /api/projects/suggest-team
  //
  // Team Architect System Agent（D-15 / D-19）：从 Goal 推导推荐 Team。
  // 该端点**不需要**已存在的 Project（Create Project 向导 Step 2 调用），
  // 直接传 goal + workspace_path。
  //
  // Q-2 / Review 5 兜底：未安装 / 超时 / 解析失败时返回固定三件套（runtime 空）。
  // -----------------------------------------------------------------------
  app.post('/api/projects/suggest-team', async (req, reply) => {
    const body = req.body as {
      goal?: string;
      workspace_path?: string;
      workspace_hint?: { stack?: string; readme_excerpt?: string };
    };

    if (!body?.goal || typeof body.goal !== 'string') {
      reply.code(400);
      return { error: 'goal is required' };
    }
    if (body.goal.length > GOAL_MAX_LENGTH) {
      reply.code(400);
      return {
        error: `goal too long: ${body.goal.length} > ${GOAL_MAX_LENGTH} chars`,
      };
    }
    if (!body.workspace_path || typeof body.workspace_path !== 'string') {
      reply.code(400);
      return { error: 'workspace_path is required' };
    }

    req.log.info(
      { goal_len: body.goal.length, workspace_path: body.workspace_path },
      '[team-architect] suggestion requested',
    );

    const result = await suggestTeam({
      goal: body.goal,
      workspace_path: body.workspace_path,
      workspace_hint: body.workspace_hint,
    });

    if (result.is_fallback) {
      req.log.warn(
        { reason: result.fallback_reason },
        '[team-architect] returned fallback team',
      );
    } else {
      req.log.info(
        { agents: result.agents.map((a) => a.name).join(', ') },
        '[team-architect] suggested team',
      );
    }

    return result;
  });
}
