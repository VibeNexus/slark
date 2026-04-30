/**
 * 前后端共享的实体类型。数据库行按 `packages/server/src/db/schema.sql`，这里是 TypeScript 镜像。
 *
 * 约定：
 *   - id 字段用 string（UUID / slug / nanoid）或 number（tasks / activity / agent_runs 自增）
 *   - 时间戳统一 number（unix ms）
 *   - JSON 字段在 DB 层是 TEXT，在这里反序列化为对应类型
 */

import type {
  ReasoningEffort,
  Runtime,
  SenderType,
  TaskStatus,
} from './constants.js';

// =============================================================================
// Project (v1.0 新增，对齐 docs/product-brief.md §D-2 / technical-decisions D-13)
// =============================================================================
export interface Project {
  id: string;
  /** URL slug, 小写 / 数字 / - _，唯一 */
  name: string;
  display_name: string | null;
  /** 代码仓库绝对路径，必填（D-8 废除沙盒后无兜底） */
  workspace_path: string;
  /** 项目目标，必填，最长 GOAL_MAX_LENGTH 字符（D-14）*/
  goal: string;
  /** 可选团队协作规则，ContextBuilder 将注入到 prompt 顶部 */
  team_rules: string | null;
  color: string | null;
  created_at: number;
}

// =============================================================================
// Channel
// =============================================================================
export interface Channel {
  id: string;
  name: string;
  description: string | null;
  type: 'channel' | 'dm';
  /**
   * v1.0 新增：归属 Project（D-2）。
   * v1.0.1 过渡期：旧 db 行可能为 null，Sprint 1 Checkpoint 2 将强制 NOT NULL。
   */
  project_id?: string | null;
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
  /**
   * v1.0 新增：归属 Project（D-13）。
   * 注：CP8.3 起 `agents.status` 字段已从 schema 移除；状态从 agent_runs 表派生。
   * 前端通过 GET /api/agents/:id/status 或 WS agent_status 事件获取实时状态。
   */
  project_id?: string | null;
  created_at: number;
}

// =============================================================================
// Agent Run (v1.0 新增，对齐 D-1 / D-18)
// =============================================================================
export type AgentRunStatus = 'thinking' | 'working' | 'error' | 'stopped';

export interface AgentRun {
  id: number;
  agent_id: string;
  channel_id: string;
  status: AgentRunStatus;
  started_at: number;
  ended_at: number | null;
  error_msg: string | null;
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
  /**
   * v1.0 新增：活动发生在哪个 channel（K-3 修正）。
   * v0 遗留 activity 行为 null。
   */
  channel_id: string | null;
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

// =============================================================================
// Team Architect System Agent（v1.0 / D-15 / D-19）
// =============================================================================

/**
 * 一个 Team Architect 推荐的 Agent 候选项。
 *
 * runtime 允许空串 '' 表示兜底场景（Q-2 决议，未装 cursor-agent 时）；
 * 此时用户必须在 Approve 后手动配置 runtime/model 才能 spawn。
 */
export interface TeamSuggestionAgent {
  name: string;
  role: string;
  description: string;
  runtime: Runtime | '';
  model: string;
  reasoning: ReasoningEffort;
}

export interface TeamSuggestion {
  agents: TeamSuggestionAgent[];
  rationale: string;
  /** true = 走了固定三件套兜底（Review 5） */
  is_fallback: boolean;
  /** 兜底触发的具体原因（仅 is_fallback = true 时存在） */
  fallback_reason?: string;
}
