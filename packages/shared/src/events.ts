/**
 * WebSocket 消息协议（对齐 PLAN.md MVP-3）
 */

import type { ChatMessage, MessageMetadata, Task } from './types.js';
import type { AgentStatus, TaskStatus } from './constants.js';

// =============================================================================
// Client → Server
// =============================================================================
export type ClientEvent =
  | { type: 'subscribe_channel'; channel_id: string }
  | { type: 'unsubscribe_channel'; channel_id: string }
  | {
      type: 'send_message';
      channel_id: string;
      thread_id?: string;
      content: string;
      /** 发送后自动创建一个 task 引用此消息 */
      as_task?: boolean;
    }
  | { type: 'typing_start'; channel_id: string }
  | { type: 'typing_stop'; channel_id: string }
  | { type: 'ping' };

// =============================================================================
// Server → Client
// =============================================================================
export type ServerEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'message_stream'; message_id: string; delta: string }
  | {
      type: 'message_done';
      message_id: string;
      final_content: string;
      metadata: MessageMetadata;
    }
  | { type: 'agent_status'; agent_id: string; status: AgentStatus; detail?: string }
  | { type: 'system_event'; event: SystemEvent }
  | { type: 'task_update'; task: Task }
  | { type: 'subscribed'; channel_id: string }
  | { type: 'pong' }
  | { type: 'error'; code: string; message: string };

// =============================================================================
// 系统事件（嵌套进 ServerEvent.system_event）
// =============================================================================
export type SystemEvent =
  | { type: 'task_created'; channel_id: string; task_id: number; title: string }
  | { type: 'task_claimed'; channel_id: string; task_id: number; agent: string }
  | {
      type: 'task_moved';
      channel_id: string;
      task_id: number;
      from: TaskStatus;
      to: TaskStatus;
      by: string;
    }
  | { type: 'agent_error'; channel_id: string; agent: string; message: string }
  | { type: 'chain_limit_reached'; channel_id: string; detail: string };
