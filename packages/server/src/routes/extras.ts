/**
 * 零散的全局 API：
 *   - /api/messages/search  全文搜索消息
 *   - /api/threads          全局 thread 列表
 *   - /api/messages/:id/save / unsave
 *   - /api/saved            列出已收藏消息
 */

import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { ChatMessage, MessageMetadata, SenderType } from '@slark/shared';

interface RawRow {
  id: string;
  channel_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  metadata_json: string | null;
  parent_id: string | null;
  reply_count: number;
  created_at: number;
}

function rowToMessage(r: RawRow): ChatMessage {
  return {
    id: r.id,
    channel_id: r.channel_id,
    sender_type: r.sender_type as SenderType,
    sender_id: r.sender_id,
    content: r.content,
    metadata: r.metadata_json ? (JSON.parse(r.metadata_json) as MessageMetadata) : null,
    parent_id: r.parent_id,
    reply_count: r.reply_count,
    created_at: r.created_at,
  };
}

export async function extraRoutes(app: FastifyInstance, db: Database): Promise<void> {
  // ---------- 消息全文搜索 ----------
  app.get('/api/messages/search', async (req) => {
    const query = req.query as { q?: string; channel_id?: string; limit?: string };
    const q = (query.q ?? '').trim();
    if (!q) return [] as ChatMessage[];
    const limit = query.limit ? Math.min(100, Number(query.limit)) : 30;
    const like = `%${q.replace(/[%_]/g, '\\$&')}%`;

    let rows: RawRow[];
    if (query.channel_id) {
      rows = db
        .prepare(
          `SELECT * FROM messages
           WHERE channel_id = ? AND content LIKE ? ESCAPE '\\'
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(query.channel_id, like, limit) as RawRow[];
    } else {
      rows = db
        .prepare(
          `SELECT * FROM messages
           WHERE content LIKE ? ESCAPE '\\'
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(like, limit) as RawRow[];
    }
    return rows.map(rowToMessage);
  });

  // ---------- 全局 Thread 列表 ----------
  app.get('/api/threads', async (req) => {
    const query = req.query as { limit?: string };
    const limit = query.limit ? Math.min(200, Number(query.limit)) : 100;
    // 找所有有 reply_count > 0 的根消息
    const rows = db
      .prepare(
        `SELECT * FROM messages
         WHERE parent_id IS NULL AND reply_count > 0
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(limit) as RawRow[];
    return rows.map(rowToMessage);
  });

  // ---------- Save / Unsave 消息 ----------
  app.post('/api/messages/:id/save', async (req, reply) => {
    const { id } = req.params as { id: string };
    const exists = db.prepare('SELECT id FROM messages WHERE id = ?').get(id);
    if (!exists) {
      reply.code(404);
      return { error: 'message not found' };
    }
    db.prepare(
      'INSERT OR REPLACE INTO saved_messages (message_id, saved_at) VALUES (?, ?)',
    ).run(id, Date.now());
    return { ok: true };
  });

  app.delete('/api/messages/:id/save', async (req, reply) => {
    const { id } = req.params as { id: string };
    db.prepare('DELETE FROM saved_messages WHERE message_id = ?').run(id);
    reply.code(204);
  });

  app.get('/api/messages/:id/saved', async (req) => {
    const { id } = req.params as { id: string };
    const row = db.prepare('SELECT 1 FROM saved_messages WHERE message_id = ?').get(id);
    return { saved: !!row };
  });

  // ---------- 收藏列表 ----------
  app.get('/api/saved', async () => {
    const rows = db
      .prepare(
        `SELECT m.* FROM saved_messages s
         JOIN messages m ON m.id = s.message_id
         ORDER BY s.saved_at DESC
         LIMIT 200`,
      )
      .all() as RawRow[];
    return rows.map(rowToMessage);
  });
}
