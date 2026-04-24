/**
 * Seed 数据（v1.0.1 修订，对齐 product-brief §D-3 + technical-decisions D-9）
 *
 * 策略（Sprint 1 Checkpoint 2）：
 *   - 全新 db（projects / channels / agents 全空）→ 不预置任何东西，Welcome 页引导 Create Project
 *   - v0 遗留 db（有 channels / agents）→ 保持原状，不做自动迁移
 *
 * 历史行为（v0，已废弃）：预置 #general 频道 + 检测到 cursor-agent 时创建 Assistant Agent
 */

import type { Database } from 'better-sqlite3';
import { agentRepo, channelRepo, projectRepo } from './repos.js';

export async function runSeed(
  db: Database,
  logger?: { info: (msg: string) => void; warn: (msg: string) => void },
): Promise<void> {
  const log = (msg: string) => logger?.info?.(msg) ?? console.log(msg);

  const projectCount = projectRepo.list(db).length;
  const channelCount = channelRepo.list(db).length;
  const agentCount = agentRepo.list(db).length;

  if (projectCount === 0 && channelCount === 0 && agentCount === 0) {
    // 全新 db：v1.0.1 明确不预置，由 Welcome 页引导用户 Create Project
    log('[seed] fresh db — no auto-seeded data; user will Create Project from the welcome page');
    return;
  }

  if (projectCount > 0) {
    // v1.0 以后的正常运行：用户已经有 Project
    log(
      `[seed] existing v1.0 db (${projectCount} project${projectCount === 1 ? '' : 's'}, ${channelCount} channel${channelCount === 1 ? '' : 's'}, ${agentCount} agent${agentCount === 1 ? '' : 's'})`,
    );
    return;
  }

  // v0 遗留 db：有 channels / agents 但无 projects
  // 不自动迁移（Q-12 决议：忽略历史数据，必要时用户手动 rm ~/.slark/slark.db）
  logger?.warn?.(
    `[seed] v0 legacy data detected (${channelCount} channels / ${agentCount} agents, 0 projects). ` +
      'Consider deleting ~/.slark/slark.db to restart fresh under v1.0 (Q-12 / N-14).',
  );
}
