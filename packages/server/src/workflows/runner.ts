/**
 * Workflow Runner（Sprint 2 CP3）
 *
 * 状态机：running ↔ awaiting_approval → completed / aborted / failed
 *
 * 核心流程：
 *   1. startWorkflowRun() 由 MessageRouter 在检测到 trigger_command 时调用
 *   2. Runner 解析 YAML，找到 first step，spawn owner agent（或转 await_approval）
 *   3. step 完成后写 state_json，按 on_complete/on_approve/on_reject 推进下一 step
 *   4. await_approval：暂停 run，等待用户在该 thread 内 /approve 或 /reject
 *   5. close_thread：归档 thread，run = completed
 *
 * Sprint 2 简化：
 *   - 单线程执行（一个 run 内串行 step），不并行
 *   - awaiting_approval 通过 advanceWithUserAction(runId, 'approve' | 'reject', reason?)
 *     由 MessageRouter 解析 /approve /reject 指令后调用
 *
 * 此文件 CP3 才会填实，CP1 仅放 stub 给 routes 引用通过。
 */

import type { Database } from 'better-sqlite3';
import type { WorkflowRun } from '@slark/shared';

/**
 * Stub - CP3 实施。
 */
export async function startWorkflowRun(
  _db: Database,
  _input: {
    workflow_id: string;
    channel_id: string;
    started_by: string;
    /** 指令尾巴，例 `/new-feature add OAuth` 中的 "add OAuth" */
    initial_input?: string;
    /** 触发该 run 的用户消息 id（runner 会在该消息下创建 thread）*/
    trigger_message_id: string;
  },
): Promise<WorkflowRun> {
  throw new Error('startWorkflowRun: CP3 not implemented yet');
}

/**
 * 用户在 awaiting_approval 状态下输入 /approve 或 /reject 时由 MessageRouter 调用。
 * Stub - CP3 实施。
 */
export async function advanceWithUserAction(
  _db: Database,
  _runId: number,
  _action: 'approve' | 'reject',
  _reason?: string,
): Promise<WorkflowRun> {
  throw new Error('advanceWithUserAction: CP3 not implemented yet');
}

/**
 * 用户 /abort 或 REST POST .../abort。
 */
export function abortWorkflowRun(
  _db: Database,
  _runId: number,
  _reason: string,
): void {
  throw new Error('abortWorkflowRun: CP3 not implemented yet');
}
