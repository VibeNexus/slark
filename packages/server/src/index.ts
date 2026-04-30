/**
 * Slark Server 入口（MVP-3 + MVP-4）
 *
 * 组件装配:
 *   REST routes    → routes/*.ts
 *   WebSocket      → ws/handler.ts（使用 hub.ts 做订阅）
 *   Message Router → messaging/router.ts
 *   Agent Engine   → agents/engine.ts + cursor-adapter.ts + runner.ts
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { getDb, closeDb } from './db/index.js';
import { runSeed } from './db/seed.js';
import { channelRepo, agentRepo } from './db/repos.js';
import { channelRoutes } from './routes/channels.js';
import { agentRoutes } from './routes/agents.js';
import { taskRoutes } from './routes/tasks.js';
import { runtimesRoutes } from './routes/runtimes.js';
import { extraRoutes } from './routes/extras.js';
import { projectRoutes } from './routes/projects.js';
import { workflowRoutes } from './routes/workflows.js';
import { registerWSRoute } from './ws/handler.js';
import { hub } from './ws/hub.js';
import { concurrencyQueue } from './agents/queue.js';

async function main() {
  const app = Fastify({
    logger: { level: config.logLevel },
  });

  await app.register(cors, {
    origin: [config.webOrigin, 'http://127.0.0.1:4178'],
    credentials: true,
  });

  await app.register(websocket);

  // 初始化数据库 + seed
  const db = getDb();
  app.log.info(`✓ Database initialized at ${config.slarkHome}/slark.db`);
  await runSeed(db, {
    info: (m) => app.log.info(m),
    warn: (m) => app.log.warn(m),
  });

  // REST
  app.get('/api/health', async () => ({
    ok: true,
    version: '0.0.1',
    slark_home: config.slarkHome,
    db: {
      channels: channelRepo.list(db).length,
      agents: agentRepo.list(db).length,
    },
    ws: hub.snapshot(),
    queue: concurrencyQueue.snapshot(),
  }));

  await runtimesRoutes(app);
  await projectRoutes(app, db);
  await channelRoutes(app, db);
  await agentRoutes(app, db);
  await taskRoutes(app, db);
  await workflowRoutes(app, db);
  await extraRoutes(app, db);

  // WebSocket
  registerWSRoute(app, db);

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`✓ Slark server listening on http://${config.host}:${config.port}`);
    app.log.info(`  REST:      http://${config.host}:${config.port}/api/health`);
    app.log.info(`  WebSocket: ws://${config.host}:${config.port}/ws`);

    const onShutdown = () => {
      app.log.info('shutting down...');
      closeDb();
      app.close().then(() => process.exit(0));
    };
    process.on('SIGINT', onShutdown);
    process.on('SIGTERM', onShutdown);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
