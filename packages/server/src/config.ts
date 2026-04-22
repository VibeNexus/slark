/**
 * 服务端运行时配置（D-10: 启动方式与环境变量）
 */

import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { DEFAULT_PORT_SERVER } from '@slark/shared';

export const config = {
  port: Number(process.env.SLARK_PORT_SERVER ?? DEFAULT_PORT_SERVER),
  host: process.env.SLARK_HOST ?? '127.0.0.1',
  slarkHome: process.env.SLARK_HOME ?? resolve(homedir(), '.slark'),
  logLevel: (process.env.SLARK_LOG_LEVEL ?? 'info') as 'error' | 'warn' | 'info' | 'debug',
  /** CORS 允许的前端 origin（开发态） */
  webOrigin: process.env.SLARK_WEB_ORIGIN ?? 'http://localhost:4178',
} as const;

export function dbPath(): string {
  return resolve(config.slarkHome, 'slark.db');
}

export function agentWorkspacePath(agentId: string): string {
  return resolve(config.slarkHome, 'agents', agentId);
}
