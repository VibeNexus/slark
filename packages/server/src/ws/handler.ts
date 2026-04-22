/**
 * WebSocket 连接处理：parse → route → subscribe/unsubscribe → send_message 走 MessageRouter
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { ClientEvent, ServerEvent } from '@slark/shared';
import type { Database } from 'better-sqlite3';
import { messageRepo } from '../db/repos.js';
import { routeUserMessage } from '../messaging/router.js';
import { hub } from './hub.js';

export function registerWSRoute(app: FastifyInstance, db: Database): void {
  app.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (socket: WebSocket) => {
      app.log.info('ws client connected');
      hub.register(socket);

      const send = (event: ServerEvent) => hub.send(socket, event);

      socket.on('message', (raw: Buffer) => {
        let parsed: ClientEvent;
        try {
          parsed = JSON.parse(raw.toString('utf8')) as ClientEvent;
        } catch {
          send({ type: 'error', code: 'invalid_json', message: 'invalid JSON' });
          return;
        }
        handleClientEvent(parsed, socket, db, app, send).catch((err: unknown) => {
          app.log.error({ err }, 'ws handler error');
          send({
            type: 'error',
            code: 'internal_error',
            message: err instanceof Error ? err.message : String(err),
          });
        });
      });

      socket.on('close', () => {
        app.log.info('ws client disconnected');
        hub.dispose(socket);
      });

      socket.on('error', (err: Error) => {
        app.log.warn({ err }, 'ws socket error');
      });
    });
  });
}

async function handleClientEvent(
  event: ClientEvent,
  socket: WebSocket,
  db: Database,
  app: FastifyInstance,
  send: (e: ServerEvent) => void,
): Promise<void> {
  switch (event.type) {
    case 'ping':
      send({ type: 'pong' });
      return;

    case 'subscribe_channel': {
      hub.subscribe(socket, event.channel_id);
      // 回送最近历史（最多 50 条）供前端初始化
      const history = messageRepo.listChannelMain(db, event.channel_id, 50);
      send({ type: 'subscribed', channel_id: event.channel_id });
      for (const msg of history) {
        send({ type: 'message', message: msg });
      }
      return;
    }

    case 'unsubscribe_channel':
      hub.unsubscribe(socket, event.channel_id);
      return;

    case 'send_message': {
      await routeUserMessage(
        {
          channelId: event.channel_id,
          content: event.content,
          threadId: event.thread_id,
          asTask: event.as_task,
        },
        {
          db,
          logger: {
            info: (m) => app.log.info(m),
            warn: (m) => app.log.warn(m),
            error: (m) => app.log.error(m),
          },
        },
      );
      return;
    }

    case 'typing_start':
    case 'typing_stop':
      // MVP 不做 typing indicator，静默接受
      return;

    default:
      send({
        type: 'error',
        code: 'unknown_event',
        message: `unknown event type`,
      });
  }
}
