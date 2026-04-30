/**
 * Intelligence REST API（Sprint 4 CP1）
 *
 * 暴露 Project 级 decisions / lessons 的 CRUD + review。
 *
 * Endpoints:
 *   GET    /api/projects/:id/decisions?status=
 *   POST   /api/projects/:id/decisions          手动 /decide（recorded_by='local-user', approved 默认）
 *   PATCH  /api/decisions/:id                   review (approve / reject) 或编辑
 *   DELETE /api/decisions/:id
 *   GET    /api/projects/:id/lessons?status=&audience=&kind=
 *   POST   /api/projects/:id/lessons            手动添加经验
 *   PATCH  /api/lessons/:id                     review 或编辑
 *   DELETE /api/lessons/:id
 */

import type { FastifyInstance } from 'fastify';
import type { Database } from 'better-sqlite3';
import type { LessonKind, ReviewStatus } from '@slark/shared';
import { decisionRepo, lessonRepo, projectRepo } from '../db/repos.js';

const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'approved', 'rejected'];
const LESSON_KINDS: LessonKind[] = ['do', 'dont', 'pattern', 'pitfall'];

export async function intelligenceRoutes(
  app: FastifyInstance,
  db: Database,
): Promise<void> {
  // ---------- Decisions ----------

  app.get('/api/projects/:id/decisions', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!projectRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'project not found' };
    }
    const q = req.query as { status?: string };
    const status = q.status && (REVIEW_STATUSES as string[]).includes(q.status)
      ? (q.status as ReviewStatus)
      : undefined;
    return decisionRepo.listByProject(db, id, { review_status: status });
  });

  app.post('/api/projects/:id/decisions', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!projectRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'project not found' };
    }
    const body = req.body as {
      title?: string;
      body?: string;
      audience?: string;
      source_message_id?: string | null;
      source_run_id?: number | null;
    };
    if (!body?.title || !body?.body) {
      reply.code(400);
      return { error: 'title and body are required' };
    }
    const d = decisionRepo.create(db, {
      project_id: id,
      title: body.title,
      body: body.body,
      audience: body.audience ?? 'all',
      source_message_id: body.source_message_id ?? null,
      source_run_id: body.source_run_id ?? null,
      recorded_by: 'local-user',
      review_status: 'approved',
    });
    reply.code(201);
    return d;
  });

  app.patch('/api/decisions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const decisionId = Number(id);
    const existing = decisionRepo.getById(db, decisionId);
    if (!existing) {
      reply.code(404);
      return { error: 'decision not found' };
    }
    const body = req.body as {
      review_status?: ReviewStatus;
      title?: string;
      body?: string;
      audience?: string;
    };
    const status = body.review_status ?? existing.review_status;
    if (!(REVIEW_STATUSES as string[]).includes(status)) {
      reply.code(400);
      return { error: 'invalid review_status' };
    }
    return decisionRepo.updateReview(db, decisionId, status, {
      title: body.title,
      body: body.body,
      audience: body.audience,
    });
  });

  app.delete('/api/decisions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const decisionId = Number(id);
    if (!decisionRepo.getById(db, decisionId)) {
      reply.code(404);
      return { error: 'decision not found' };
    }
    decisionRepo.remove(db, decisionId);
    reply.code(204);
  });

  // ---------- Lessons ----------

  app.get('/api/projects/:id/lessons', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!projectRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'project not found' };
    }
    const q = req.query as { status?: string; audience?: string; kind?: string };
    const status =
      q.status && (REVIEW_STATUSES as string[]).includes(q.status)
        ? (q.status as ReviewStatus)
        : undefined;
    const kind =
      q.kind && (LESSON_KINDS as string[]).includes(q.kind) ? (q.kind as LessonKind) : undefined;
    return lessonRepo.listByProject(db, id, {
      review_status: status,
      audience: q.audience,
      kind,
    });
  });

  app.post('/api/projects/:id/lessons', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!projectRepo.getById(db, id)) {
      reply.code(404);
      return { error: 'project not found' };
    }
    const body = req.body as {
      kind?: string;
      title?: string;
      body?: string;
      audience?: string;
      tags?: string[];
      source_message_id?: string | null;
      source_run_id?: number | null;
    };
    if (!body?.title || !body?.body) {
      reply.code(400);
      return { error: 'title and body are required' };
    }
    const kind: LessonKind =
      body.kind && (LESSON_KINDS as string[]).includes(body.kind)
        ? (body.kind as LessonKind)
        : 'do';
    const l = lessonRepo.create(db, {
      project_id: id,
      kind,
      title: body.title,
      body: body.body,
      audience: body.audience ?? 'all',
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      source_message_id: body.source_message_id ?? null,
      source_run_id: body.source_run_id ?? null,
      recorded_by: 'local-user',
      review_status: 'approved',
    });
    reply.code(201);
    return l;
  });

  app.patch('/api/lessons/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const lessonId = Number(id);
    const existing = lessonRepo.getById(db, lessonId);
    if (!existing) {
      reply.code(404);
      return { error: 'lesson not found' };
    }
    const body = req.body as {
      review_status?: ReviewStatus;
      title?: string;
      body?: string;
      audience?: string;
      kind?: string;
      tags?: string[];
    };
    const status = body.review_status ?? existing.review_status;
    if (!(REVIEW_STATUSES as string[]).includes(status)) {
      reply.code(400);
      return { error: 'invalid review_status' };
    }
    let kind: LessonKind | undefined;
    if (body.kind !== undefined) {
      if (!(LESSON_KINDS as string[]).includes(body.kind)) {
        reply.code(400);
        return { error: 'invalid kind' };
      }
      kind = body.kind as LessonKind;
    }
    return lessonRepo.updateReview(db, lessonId, status, {
      title: body.title,
      body: body.body,
      audience: body.audience,
      kind,
      tags: body.tags,
    });
  });

  app.delete('/api/lessons/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const lessonId = Number(id);
    if (!lessonRepo.getById(db, lessonId)) {
      reply.code(404);
      return { error: 'lesson not found' };
    }
    lessonRepo.remove(db, lessonId);
    reply.code(204);
  });
}
