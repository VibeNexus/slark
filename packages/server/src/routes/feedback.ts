/**
 * Agent Feedback REST API（Sprint 5 CP4 / CP5）
 *
 * Endpoints:
 *   GET  /api/agents/:id/feedback                列出该 agent 的全部 feedback（任何状态）
 *   POST /api/agents/:id/feedback/run-coach      手动触发 Coach 跑一轮（不等阈值）
 *   POST /api/feedback/:id/apply                 Apply：把 description_after 写入 agents.description
 *   POST /api/feedback/:id/reject                标 rejected
 *   POST /api/feedback/:id/rollback              已 applied 的 feedback 回滚 description_before（Q-6）
 */

import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { LOCAL_USER_ID } from '@slark/shared';
import { agentRepo, feedbackRepo } from '../db/repos.js';
import { runCoachForAgent } from '../system-agents/coach.js';
import { EVALUATOR_WINDOW_MS } from '@slark/shared';

export async function feedbackRoutes(
  app: FastifyInstance,
  db: Database,
): Promise<void> {
  app.get('/api/agents/:id/feedback', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!agentRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    return feedbackRepo.listByAgent(db, id);
  });

  app.post('/api/agents/:id/feedback/run-coach', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = agentRepo.getById(db, id);
    if (!agent) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    const since = Date.now() - EVALUATOR_WINDOW_MS;
    try {
      const feedback = await runCoachForAgent(db, agent, since, {
        info: (m) => req.log.info(m),
        warn: (m) => req.log.warn(m),
        error: (m) => req.log.error(m),
      });
      return { feedback };
    } catch (e) {
      reply.code(500);
      return { error: (e as Error).message };
    }
  });

  app.post('/api/feedback/:id/apply', async (req, reply) => {
    const { id } = req.params as { id: string };
    const fb = feedbackRepo.getById(db, Number(id));
    if (!fb) {
      reply.code(404);
      return { error: 'feedback not found' };
    }
    if (fb.status !== 'pending') {
      reply.code(409);
      return { error: `feedback is already ${fb.status}` };
    }
    // 1. 更新 agent.description
    agentRepo.update(db, fb.agent_id, { description: fb.description_after });
    // 2. 标 status='applied'
    const updated = feedbackRepo.setStatus(db, fb.id, 'applied', LOCAL_USER_ID);
    return updated;
  });

  app.post('/api/feedback/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const fb = feedbackRepo.getById(db, Number(id));
    if (!fb) {
      reply.code(404);
      return { error: 'feedback not found' };
    }
    if (fb.status !== 'pending') {
      reply.code(409);
      return { error: `feedback is already ${fb.status}` };
    }
    return feedbackRepo.setStatus(db, fb.id, 'rejected', LOCAL_USER_ID);
  });

  app.post('/api/feedback/:id/rollback', async (req, reply) => {
    const { id } = req.params as { id: string };
    const fb = feedbackRepo.getById(db, Number(id));
    if (!fb) {
      reply.code(404);
      return { error: 'feedback not found' };
    }
    if (fb.status !== 'applied') {
      reply.code(409);
      return { error: `only applied feedback can be rolled back; status=${fb.status}` };
    }
    // 恢复 description_before
    agentRepo.update(db, fb.agent_id, { description: fb.description_before });
    const updated = feedbackRepo.setStatus(db, fb.id, 'rolled_back', LOCAL_USER_ID);
    return updated;
  });
}
