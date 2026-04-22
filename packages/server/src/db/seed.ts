/**
 * 首次启动 seed 数据（D-9）
 *
 * 规则：
 *   - 如果 channels 表空 → 创建 #general 频道
 *   - 如果 agents 表空且检测到 cursor-agent → 创建 Assistant Agent
 *     - 自动加入 #general
 *     - 自动创建 ~/.slark/agents/{id}/ 工作目录
 */

import { mkdirSync } from 'node:fs';
import type { Database } from 'better-sqlite3';
import { detectRuntime } from '../runtime-detect.js';
import { agentWorkspacePath } from '../config.js';
import { agentRepo, channelRepo } from './repos.js';

export async function runSeed(db: Database, logger?: { info: (msg: string) => void }): Promise<void> {
  const log = (msg: string) => logger?.info?.(msg) ?? console.log(msg);

  // 1. #general 频道
  const channels = channelRepo.list(db);
  let general = channels.find((c) => c.name === 'general');
  if (!general) {
    general = channelRepo.create(db, {
      id: 'general',
      name: 'general',
      description: 'General channel',
      type: 'channel',
    });
    log('[seed] created #general channel');
  }

  // 2. 默认 Assistant Agent（仅当 cursor-agent 已安装且当前没有任何 agent）
  const existingAgents = agentRepo.list(db);
  if (existingAgents.length > 0) {
    log(`[seed] skipping default agent (${existingAgents.length} agents already exist)`);
    return;
  }

  const cursor = await detectRuntime('cursor');
  if (!cursor.installed) {
    log('[seed] cursor-agent not installed, skipping default agent');
    return;
  }

  const assistant = agentRepo.create(db, {
    name: 'Assistant',
    avatar: null,
    description: '通用 AI 助手。可以回答问题、写代码、执行命令。',
    runtime: 'cursor',
    model: 'composer-2-fast',
    reasoning: 'medium',
  });
  agentRepo.addToChannel(db, general.id, assistant.id);

  try {
    mkdirSync(agentWorkspacePath(assistant.id), { recursive: true });
  } catch (e) {
    log(`[seed] warning: failed to create workspace dir: ${(e as Error).message}`);
  }

  log(`[seed] created default Assistant agent (runtime=cursor, model=composer-2-fast)`);
}
