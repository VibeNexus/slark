import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import { channelRepo, agentRepo, messageRepo } from '../db/repos.js';

export async function channelRoutes(app: FastifyInstance, db: Database): Promise<void> {
  // 列出所有频道
  app.get('/api/channels', async () => channelRepo.list(db));

  // 创建频道
  app.post('/api/channels', async (req, reply) => {
    const body = req.body as {
      id?: string;
      name: string;
      description?: string | null;
      type?: 'channel' | 'dm';
    };
    if (!body?.name) {
      reply.code(400);
      return { error: 'name is required' };
    }
    return channelRepo.create(db, {
      id: body.id,
      name: body.name,
      description: body.description ?? null,
      type: body.type ?? 'channel',
    });
  });

  // 频道详情
  app.get('/api/channels/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ch = channelRepo.getById(db, id);
    if (!ch) {
      reply.code(404);
      return { error: 'channel not found' };
    }
    return ch;
  });

  // 更新频道
  app.patch('/api/channels/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { name?: string; description?: string | null };
    const ch = channelRepo.update(db, id, body ?? {});
    if (!ch) {
      reply.code(404);
      return { error: 'channel not found' };
    }
    return ch;
  });

  // 删除频道
  app.delete('/api/channels/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    channelRepo.remove(db, id);
    reply.code(204);
  });

  // 频道主线消息列表
  app.get('/api/channels/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    const query = req.query as { limit?: string; before?: string; parent_id?: string };
    const limit = query.limit ? Math.min(200, Number(query.limit)) : 50;

    if (query.parent_id) {
      return messageRepo.listThread(db, query.parent_id);
    }
    return messageRepo.listChannelMain(db, id, limit, query.before);
  });

  // 频道内 agent 列表
  app.get('/api/channels/:id/agents', async (req) => {
    const { id } = req.params as { id: string };
    return agentRepo.listInChannel(db, id);
  });

  // 加入 agent
  app.post('/api/channels/:id/agents', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { agent_id } = req.body as { agent_id: string };
    if (!agent_id) {
      reply.code(400);
      return { error: 'agent_id is required' };
    }
    agentRepo.addToChannel(db, id, agent_id);
    reply.code(201);
    return { ok: true };
  });

  // 移除 agent
  app.delete('/api/channels/:id/agents/:agentId', async (req, reply) => {
    const { id, agentId } = req.params as { id: string; agentId: string };
    agentRepo.removeFromChannel(db, id, agentId);
    reply.code(204);
  });

  // Stop all agents in channel（MVP-4 接入 Agent Engine 后有实际停止效果）
  app.post('/api/channels/:id/stop-all', async (req) => {
    const { id } = req.params as { id: string };
    const agents = agentRepo.listInChannel(db, id);
    for (const a of agents) {
      agentRepo.updateStatus(db, a.id, 'stopped');
    }
    return { stopped: agents.length };
  });
}
