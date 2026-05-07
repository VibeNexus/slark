/**
 * Slark Server 入口（MVP-3 + MVP-4）
 *
 * 组件装配:
 *   REST routes    → routes/*.ts
 *   WebSocket      → ws/handler.ts（使用 hub.ts 做订阅）
 *   Message Router → messaging/router.ts
 *   Agent Engine   → agents/engine.ts + cursor-adapter.ts + runner.ts
 */

// Sprint 4-ext：必须在 import config / 任何依赖 process.env 的模块之前加载 .env / settings.json，
// 否则像 SLARK_CURSOR_BACKEND / CURSOR_API_KEY 这类后端切换变量在 import 时被读到的是 undefined。
//
// 优先级（后到不覆盖前到的）：
//   1. shell export 的 env (loadDotenv 不动)
//   2. .env (loadDotenv 注入)
//   3. ~/.slark/settings.json (mergeUserSettings 注入)  ← UI 改这个
//   4. defaults
import { loadDotenv, mergeUserSettings, configureCursorRipgrep } from './load-env.js';
const __envLoad = loadDotenv();
const __settingsLoad = mergeUserSettings();
const __rgConfig = configureCursorRipgrep();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { getDb, closeDb } from './db/index.js';
import { runSeed } from './db/seed.js';
import { channelRepo, agentRepo, projectRepo, workflowRepo } from './db/repos.js';
import { importBuiltinsForProject } from './workflows/builtin-import.js';
import { deriveResponsibilitiesForWorkflow } from './workflows/derive-responsibilities.js';
import { startEvaluatorScheduler } from './system-agents/evaluator.js';
import { channelRoutes } from './routes/channels.js';
import { agentRoutes } from './routes/agents.js';
import { taskRoutes } from './routes/tasks.js';
import { runtimesRoutes } from './routes/runtimes.js';
import { settingsRoutes } from './routes/settings.js';
import { extraRoutes } from './routes/extras.js';
import { feedbackRoutes } from './routes/feedback.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { projectRoutes } from './routes/projects.js';
import { skillRoutes } from './routes/skills.js';
import { workflowRoutes } from './routes/workflows.js';
import { workflowSessionRoutes } from './routes/workflow-sessions.js';
import { registerWSRoute } from './ws/handler.js';
import { hub } from './ws/hub.js';
import { concurrencyQueue } from './agents/queue.js';

async function main() {
  const app = Fastify({
    logger: { level: config.logLevel },
  });

  if (__envLoad.loaded) {
    app.log.info(
      { source: __envLoad.source, keys: __envLoad.keysApplied },
      '[env] loaded .env file',
    );
  }
  if (__settingsLoad.loaded) {
    app.log.info(
      { source: __settingsLoad.source, keys: __settingsLoad.keysApplied },
      '[env] merged user settings.json',
    );
  }
  if (__rgConfig.configured) {
    if (!__rgConfig.alreadySet) {
      app.log.info(
        { CURSOR_RIPGREP_PATH: __rgConfig.path },
        '[env] auto-configured Cursor SDK ripgrep path',
      );
    }
  } else if (__rgConfig.reason && !__rgConfig.reason.startsWith('SLARK_CURSOR_BACKEND')) {
    app.log.warn({ reason: __rgConfig.reason }, '[env] Cursor SDK ripgrep not located');
  }

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

  // Sprint 2 CP2：给已存在的 Project 补齐 builtin workflow 模板（已存在的跳过）
  for (const p of projectRepo.list(db)) {
    const res = importBuiltinsForProject(db, p.id);
    if (res.imported > 0) {
      app.log.info(
        { project: p.name, ...res },
        '[workflows] builtin templates seeded',
      );
    }
    if (res.errors.length > 0) {
      app.log.warn(
        { project: p.name, errors: res.errors },
        '[workflows] some builtin templates failed to seed',
      );
    }
  }

  // Sprint 3 CP1：给已存在的 workflows 补齐 responsibilities（首次升级到 schema v5 时需要）
  for (const wf of workflowRepo.list(db)) {
    try {
      const res = deriveResponsibilitiesForWorkflow(db, wf.id);
      if (res.unresolved.length > 0) {
        app.log.warn(
          { workflow: wf.name, unresolved: res.unresolved },
          '[workflows] derived responsibilities have unresolved agents (will resolve once those agents exist)',
        );
      }
    } catch (e) {
      app.log.warn(
        { err: e, workflow: wf.name },
        '[workflows] failed to derive responsibilities',
      );
    }
  }

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
  await settingsRoutes(app);
  await projectRoutes(app, db);
  await channelRoutes(app, db);
  await agentRoutes(app, db);
  await taskRoutes(app, db);
  await workflowRoutes(app, db);
  await intelligenceRoutes(app, db);
  await feedbackRoutes(app, db);
  await skillRoutes(app, db);
  await workflowSessionRoutes(app, db);
  await extraRoutes(app, db);

  // WebSocket
  registerWSRoute(app, db);

  // Sprint 5 CP2：启动 Evaluator 后台调度（每 24h 一轮）
  startEvaluatorScheduler(db, {
    info: (m) => app.log.info(m),
    warn: (m) => app.log.warn(m),
    error: (m) => app.log.error(m),
  });

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
