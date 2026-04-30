/**
 * Skill Matrix REST API（Sprint 6 CP4 / CP5）
 *
 * Endpoints:
 *   GET /api/agents/:id/skills                            该 agent 的所有 skill
 *   GET /api/projects/:id/skills                          该 project 内所有 agent skill 概览
 *   GET /api/projects/:id/skill-suggest?keyword=auth      推荐 assignee（按 keyword 匹配 skill_key）
 */

import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { agentRepo, projectRepo, skillRepo } from '../db/repos.js';

export async function skillRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get('/api/agents/:id/skills', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!agentRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    return skillRepo.listByAgent(db, id);
  });

  app.get('/api/projects/:id/skills', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!projectRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'project not found' };
    }
    return skillRepo.listByProject(db, id);
  });

  app.get('/api/projects/:id/skill-suggest', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!projectRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'project not found' };
    }
    const q = req.query as { keyword?: string };
    if (!q.keyword || !q.keyword.trim()) return [];
    return skillRepo.suggestAgents(db, id, q.keyword.trim(), 5);
  });
}
