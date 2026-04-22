/**
 * 前后端共享的实体类型。数据库行按 PLAN.md MVP-2 schema，这里是 TypeScript 镜像。
 *
 * 约定：
 *   - id 字段用 string（UUID v4）或 number（tasks 自增）
 *   - 时间戳统一 number（unix ms）
 *   - JSON 字段在 DB 层是 TEXT，在这里反序列化为对应类型
 */

import type {
  AgentStatus,
  ReasoningEffort,
  Runtime,
  SenderType,
  TaskStatus,
} from './constants.js';

// =============================================================================
// Channel
// =============================================================================
export interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: 'channel' | 'dm';
  created_at: number;
}

// =============================================================================
// Agent
// =============================================================================
export interface Agent {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  runtime: Runtime;
  model: string | null;
  reasoning: ReasoningEffort | null;
  env_vars: Record<string, string>;
  status: AgentStatus;
  created_at: number;
}

// =============================================================================
// Message
// =============================================================================
export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_type: SenderType;
  /** user: 'local-user' | agent: agent_id | system: null */
  sender_id: string | null;
  content: string;
  metadata: MessageMetadata | null;
  /** Thread 根消息 ID，NULL = 顶层消息 */
  parent_id: string | null;
  /** 仅根消息维护 */
  reply_count: number;
  created_at: number;
}

/**
 * 消息附加元数据（D-7 契约）
 */
export interface MessageMetadata {
  /** 解析自 content 的 @mention 列表 */
  mentions?: Array<{ name: string; agent_id: string | null }>;

  /** 关联的 task（当 Task 状态变更产生系统消息时） */
  task_ref?: {
    id: number;
    title: string;
    status: TaskStatus;
    assignee_agent_id: string | null;
  };

  /** 链式触发深度（0 = 用户首次发起） */
  chain_depth?: number;
  /** 链式触发的"上游"消息 id */
  triggered_by_message_id?: string;

  /** CLI 工具调用记录 */
  tool_calls?: Array<{
    tool: string;
    args: Record<string, unknown>;
    result?: string;
    success?: boolean;
    duration_ms?: number;
  }>;

  /** 消息是否正在流式输出 */
  streaming?: boolean;

  /** Agent 响应的元信息（sender_type=agent） */
  agent_meta?: {
    runtime: Runtime;
    model: string;
    total_duration_ms: number;
    input_tokens_estimate?: number;
    output_tokens_estimate?: number;
  };

  /** System 消息事件类型（sender_type=system） */
  system_event?:
    | { type: 'task_created'; task_id: number; title: string }
    | { type: 'task_claimed'; task_id: number; agent: string }
    | {
        type: 'task_moved';
        task_id: number;
        from: TaskStatus;
        to: TaskStatus;
        by: string;
      }
    | { type: 'agent_error'; agent: string; message: string }
    | { type: 'chain_limit_reached'; detail: string };
}

// =============================================================================
// Task
// =============================================================================
export interface Task {
  id: number;
  channel_id: string;
  title: string;
  status: TaskStatus;
  assignee_agent_id: string | null;
  created_by: string;
  source_message_id: string | null;
  created_at: number;
  updated_at: number;
}

// =============================================================================
// Agent Activity
// =============================================================================
export type ActivityType = 'thinking' | 'working' | 'output' | 'error' | 'idle';

export interface AgentActivity {
  id: number;
  agent_id: string;
  type: ActivityType;
  detail: string | null;
  created_at: number;
}

// =============================================================================
// Runtime Detection
// =============================================================================
export interface RuntimeDetection {
  id: Runtime;
  label: string;
  installed: boolean;
  version?: string;
  path?: string;
  note?: string;
  /** MVP 当前 Slark 端是否已实装该 runtime（未实装会 disable） */
  enabled_in_slark: boolean;
}
