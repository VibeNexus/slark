/**
 * 全局常量（所有默认值对齐 docs/technical-decisions.md 的 D-N 规则）
 */

// =============================================================================
// Token 预算（D-4）
// =============================================================================
export const MAX_CONTEXT_TOKENS = 8000;
export const DESCRIPTION_BUDGET = 2000;
export const HISTORY_BUDGET = 5500;
export const CURRENT_MESSAGE_BUDGET = 500;

// 粗估 token（D-4：4 字符 ≈ 1 token，不引入 tokenizer 依赖）
export const CHARS_PER_TOKEN = 4;

// =============================================================================
// 并发控制（D-5）
// =============================================================================
export const MAX_CONCURRENT_PROCESSES = 3;
export const PROCESS_TIMEOUT_MS = 300_000; // 5 分钟
export const QUEUE_MAX_SIZE = 20;

// =============================================================================
// 链式触发防护（D-6）
// =============================================================================
export const MAX_CHAIN_DEPTH = 10;
export const MAX_AGENT_CONSECUTIVE_TRIGGERS = 3;
export const MAX_MENTIONS_PER_MESSAGE = 5;

// =============================================================================
// Activity 日志保留（D-3）
// =============================================================================
export const ACTIVITY_RETENTION_PER_AGENT = 500;

// =============================================================================
// Project Goal 长度限制（D-14，Q-3 决议）
// =============================================================================
export const GOAL_MAX_LENGTH = 500;

// =============================================================================
// Team Architect System Agent（D-15 / D-19）
// =============================================================================
/** Team Architect spawn 超时（独立于 PROCESS_TIMEOUT_MS） */
export const TEAM_ARCHITECT_TIMEOUT_MS = 30_000;

/** Scribe spawn 超时（thread 体量较大，给 60s）*/
export const SCRIBE_TIMEOUT_MS = 60_000;

// =============================================================================
// 端口与数据目录（D-10）
// =============================================================================
export const DEFAULT_PORT_WEB = 4178;
export const DEFAULT_PORT_SERVER = 4179;

// =============================================================================
// Runtime 注册表（MVP 仅 Cursor）
// =============================================================================
export type Runtime = 'cursor' | 'codex' | 'claude' | 'kimi' | 'copilot' | 'gemini';

export interface RuntimeMeta {
  id: Runtime;
  label: string;
  /** MVP 是否启用（未启用只展示，不可选） */
  available: boolean;
  /** 禁用时的提示 */
  note?: string;
}

export const RUNTIME_REGISTRY: RuntimeMeta[] = [
  { id: 'cursor', label: 'Cursor CLI', available: true },
  { id: 'codex', label: 'Codex CLI', available: false, note: 'coming soon' },
  { id: 'claude', label: 'Claude Code', available: false, note: 'coming soon' },
  { id: 'kimi', label: 'Kimi CLI', available: false, note: 'coming soon' },
  { id: 'copilot', label: 'Copilot CLI', available: false, note: 'coming soon' },
  { id: 'gemini', label: 'Gemini CLI', available: false, note: 'coming soon' },
];

// =============================================================================
// Agent 状态（D-1）
// =============================================================================
export const AGENT_STATES = ['idle', 'thinking', 'working', 'error', 'stopped'] as const;
export type AgentStatus = (typeof AGENT_STATES)[number];

// =============================================================================
// 消息 sender 类型
// =============================================================================
export type SenderType = 'user' | 'agent' | 'system';
export const LOCAL_USER_ID = 'local-user';

// =============================================================================
// Task 状态
// =============================================================================
export const TASK_STATES = ['todo', 'in_progress', 'in_review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATES)[number];

// =============================================================================
// Reasoning effort
// =============================================================================
export const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];
