/**
 * AgentEngine — 把 Adapter / Runner / ContextBuilder / ActivityRecorder / Queue 整合起来
 *
 * 核心 API：trigger(agentId, triggerCtx) — 被 Message Router 调用
 *
 * 内部流程：
 *   1. 查 agent + 构建 context（description + 团队 + history + trigger message）
 *   2. 创建占位 agent message（streaming=true）并广播 `message` 事件
 *   3. 更新 status=thinking → 广播 agent_status
 *   4. 进入并发队列 → spawn CLI
 *   5. CLI 事件回调：
 *        text.delta / thinking.delta → 广播 message_stream（frontend 累加渲染）
 *        text.completed → 更新占位消息 content，广播 message_done
 *        error / timeout → status=error + 红色 system message
 *   6. CLI 退出 → status=idle → 广播
 *   7. 返回完整文本 & metadata（供 Message Router 继续链式触发解析）
 */

import { mkdirSync } from 'node:fs';
import type { Database } from 'better-sqlite3';
import type { AgentStatus, ChatMessage, MessageMetadata, Runtime } from '@slark/shared';
import { LOCAL_USER_ID } from '@slark/shared';
import { agentRepo, channelRepo, messageRepo } from '../db/repos.js';
import { agentWorkspacePath } from '../config.js';
import { hub } from '../ws/hub.js';
import { buildContext } from './context-builder.js';
import { ActivityRecorder } from './activity-recorder.js';
import { concurrencyQueue } from './queue.js';
import { runCLI } from './runner.js';
import { CursorAdapter } from './cursor-adapter.js';
import type { CLIAdapter, CLIEvent } from './types.js';

// Runtime 注册表：MVP 只实装 cursor
const ADAPTERS: Partial<Record<Runtime, () => CLIAdapter>> = {
  cursor: () => new CursorAdapter(),
};

export function getAdapterFor(runtime: Runtime): CLIAdapter | null {
  const factory = ADAPTERS[runtime];
  return factory ? factory() : null;
}

export interface TriggerContext {
  channelId: string;
  /** 触发消息（用户发的那条，或上游 agent 回复） */
  triggerMessage: ChatMessage;
  /** 可选：thread 根消息 id（如果回复应放进 thread） */
  parentMessageId?: string;
  /** 链式深度（0 = 用户首次） */
  chainDepth?: number;
}

export interface TriggerResult {
  agentReplyMessage: ChatMessage;
  fullText: string;
  duration_ms: number;
  ok: boolean;
  errorMessage?: string;
}

export interface AgentEngineDeps {
  db: Database;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
}

/**
 * 触发 agent 响应。返回完整结果 (fullText 可用于后续链式触发解析)。
 */
export async function triggerAgent(
  agentId: string,
  ctx: TriggerContext,
  deps: AgentEngineDeps,
): Promise<TriggerResult> {
  const { db, logger } = deps;
  const log = logger ?? {
    info: (m: string) => console.log(m),
    warn: (m: string) => console.warn(m),
    error: (m: string) => console.error(m),
  };

  const agent = agentRepo.getById(db, agentId);
  if (!agent) {
    return {
      agentReplyMessage: null as unknown as ChatMessage,
      fullText: '',
      duration_ms: 0,
      ok: false,
      errorMessage: `agent ${agentId} not found`,
    };
  }

  if (agent.status === 'stopped') {
    return {
      agentReplyMessage: null as unknown as ChatMessage,
      fullText: '',
      duration_ms: 0,
      ok: false,
      errorMessage: `agent ${agent.name} is stopped`,
    };
  }

  const adapter = getAdapterFor(agent.runtime);
  if (!adapter) {
    const errMsg = `runtime "${agent.runtime}" is not implemented in this MVP`;
    emitSystemError(db, ctx.channelId, agent.name, errMsg);
    return {
      agentReplyMessage: null as unknown as ChatMessage,
      fullText: '',
      duration_ms: 0,
      ok: false,
      errorMessage: errMsg,
    };
  }

  // 1. 构建上下文
  const channel = channelRepo.getById(db, ctx.channelId);
  const teamAgents = channel ? agentRepo.listInChannel(db, channel.id) : [];
  // 取最近 50 条历史（context-builder 会再按 token 预算裁剪）
  const history = ctx.parentMessageId
    ? messageRepo.listThread(db, ctx.parentMessageId)
    : messageRepo.listChannelMain(db, ctx.channelId, 50);

  // 排除触发消息自身与触发消息之后的历史
  const historyBeforeTrigger = history.filter(
    (m) => m.created_at < ctx.triggerMessage.created_at,
  );

  const built = buildContext({
    targetAgent: agent,
    teamAgents,
    history: historyBeforeTrigger,
    triggerMessage: ctx.triggerMessage,
  });

  log.info(
    `[engine] triggering ${agent.name} (chain_depth=${ctx.chainDepth ?? 0}, ctx=${built.estimatedTokens}t)`,
  );

  // 2. 创建占位 agent message
  const placeholderMetadata: MessageMetadata = {
    streaming: true,
    chain_depth: ctx.chainDepth ?? 0,
    triggered_by_message_id: ctx.triggerMessage.id,
    agent_meta: {
      runtime: agent.runtime,
      model: agent.model ?? 'default',
      total_duration_ms: 0,
    },
  };

  const placeholder = messageRepo.create(db, {
    channel_id: ctx.channelId,
    sender_type: 'agent',
    sender_id: agent.id,
    content: '',
    metadata: placeholderMetadata,
    parent_id: ctx.parentMessageId ?? null,
  });

  hub.broadcast(ctx.channelId, { type: 'message', message: placeholder });

  // 3. 状态 → thinking
  updateAgentStatus(db, agent.id, 'thinking', ctx.channelId);

  // 4. 确保 workspace 目录存在
  const workspace = agentWorkspacePath(agent.id);
  try {
    mkdirSync(workspace, { recursive: true });
  } catch (e) {
    log.warn(`failed to ensure workspace: ${(e as Error).message}`);
  }

  // 5. 并发队列 + spawn
  const activity = new ActivityRecorder(db, agent.id);
  activity.spawnStart(
    `Spawning ${agent.runtime}${agent.model ? ` with model=${agent.model}` : ''}`,
  );

  let streamedChars = 0;
  let hasSwitchedToWorking = false;

  const runResult = await concurrencyQueue.run(() =>
    runCLI(
      adapter,
      adapter.buildCommand({
        prompt: built.prompt,
        model: agent.model,
        reasoning: agent.reasoning,
        workingDirectory: workspace,
        envVars: agent.env_vars,
        permissive: true,
      }),
      {
        onEvent: (event: CLIEvent) => {
          activity.recordEvent(event);

          // 状态切换：首个 text/thinking delta → working
          if (
            !hasSwitchedToWorking &&
            (event.type === 'text.delta' ||
              event.type === 'thinking.delta' ||
              event.type === 'tool.started')
          ) {
            hasSwitchedToWorking = true;
            updateAgentStatus(db, agent.id, 'working', ctx.channelId);
          }

          // 流式文本 → 广播 message_stream
          if (event.type === 'text.delta') {
            streamedChars += event.text.length;
            hub.broadcast(ctx.channelId, {
              type: 'message_stream',
              message_id: placeholder.id,
              delta: event.text,
            });
          }

          // 工具调用状态 → system event 可选，MVP 仅通过 activity 记录（前端 Profile 页看）
          if (event.type === 'error') {
            log.warn(`[engine] agent ${agent.name} error: ${event.message}`);
          }
        },
        onStderr: (line) => {
          // Codex 的 stdin 提示等，不需要上报
          if (!line.includes('Reading additional input')) {
            log.warn(`[${agent.name} stderr] ${line.slice(0, 200)}`);
          }
        },
      },
    ),
  );

  // 6. 队列满
  if (!runResult.ok) {
    updateAgentStatus(db, agent.id, 'error', ctx.channelId);
    const errMsg = 'Too many concurrent requests. Please try again later.';
    finalizeError(db, placeholder, errMsg);
    emitSystemError(db, ctx.channelId, agent.name, errMsg);
    return {
      agentReplyMessage: placeholder,
      fullText: '',
      duration_ms: 0,
      ok: false,
      errorMessage: errMsg,
    };
  }

  const result = runResult.result;
  const fullText = result.fullText.trim();
  const hasError = result.events.some((e) => e.type === 'error');
  const finalOk = !result.timedOut && !hasError && (result.exitCode === 0 || result.exitCode === null);

  // 7. 更新占位消息的最终 content / metadata
  const finalMetadata: MessageMetadata = {
    streaming: false,
    chain_depth: ctx.chainDepth ?? 0,
    triggered_by_message_id: ctx.triggerMessage.id,
    agent_meta: {
      runtime: agent.runtime,
      model: agent.model ?? 'default',
      total_duration_ms: result.duration_ms,
      input_tokens_estimate: built.estimatedTokens,
      output_tokens_estimate: Math.ceil(fullText.length / 4),
    },
    tool_calls: result.events
      .filter((e): e is Extract<CLIEvent, { type: 'tool.completed' }> => e.type === 'tool.completed')
      .map((e) => ({
        tool: e.tool,
        args: {},
        result: e.result,
        success: e.success,
        duration_ms: e.duration_ms,
      })),
  };

  const finalContent = fullText || (finalOk ? '(no response)' : 'Agent failed to produce a response.');
  messageRepo.updateContent(db, placeholder.id, finalContent, finalMetadata);
  const updated = messageRepo.getById(db, placeholder.id) ?? placeholder;

  hub.broadcast(ctx.channelId, {
    type: 'message_done',
    message_id: placeholder.id,
    final_content: finalContent,
    metadata: finalMetadata,
  });

  // 8. 最终状态
  if (finalOk) {
    updateAgentStatus(db, agent.id, 'idle', ctx.channelId);
  } else {
    updateAgentStatus(db, agent.id, 'error', ctx.channelId);
    const errEvent = result.events.find((e) => e.type === 'error');
    const errMsg = errEvent && 'message' in errEvent ? errEvent.message : 'Unknown error';
    emitSystemError(db, ctx.channelId, agent.name, errMsg);
  }

  log.info(
    `[engine] ${agent.name} done: ok=${finalOk} chars=${streamedChars} duration=${result.duration_ms}ms`,
  );

  return {
    agentReplyMessage: updated,
    fullText: finalContent,
    duration_ms: result.duration_ms,
    ok: finalOk,
    errorMessage: finalOk ? undefined : 'Agent responded with error',
  };
}

// =============================================================================
// Helpers
// =============================================================================

function updateAgentStatus(
  db: Database,
  agentId: string,
  status: AgentStatus,
  channelId: string,
): void {
  agentRepo.updateStatus(db, agentId, status);
  hub.broadcast(channelId, { type: 'agent_status', agent_id: agentId, status });
}

function emitSystemError(
  db: Database,
  channelId: string,
  agentName: string,
  message: string,
): void {
  const sysMsg = messageRepo.create(db, {
    channel_id: channelId,
    sender_type: 'system',
    sender_id: LOCAL_USER_ID,
    content: `⚠ @${agentName} error: ${message}`,
    metadata: {
      system_event: {
        type: 'agent_error',
        agent: agentName,
        message,
      },
    },
  });
  hub.broadcast(channelId, { type: 'message', message: sysMsg });
}

function finalizeError(db: Database, placeholder: ChatMessage, reason: string): void {
  const meta: MessageMetadata = {
    streaming: false,
  };
  messageRepo.updateContent(db, placeholder.id, `⚠ ${reason}`, meta);
  hub.broadcast(placeholder.channel_id, {
    type: 'message_done',
    message_id: placeholder.id,
    final_content: `⚠ ${reason}`,
    metadata: meta,
  });
}
