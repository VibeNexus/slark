/**
 * Message Router — 处理用户/Agent 发送的消息
 *
 * 流程:
 *   1. 解析 @mention 找到目标 agent 名
 *   2. 将消息写入 DB（user / agent 发送，含 metadata.mentions）
 *   3. 广播 `message` 事件给频道订阅者
 *   4. 对每个 @mention 匹配到的 agent，调用 AgentEngine.trigger
 *      （并发执行；Engine 内部有队列限制）
 *   5. Agent 响应完成后，继续解析其回复中的 @mention → 链式触发
 *      - 深度 >= MAX_CHAIN_DEPTH → 停止
 *      - 同 agent 在同 thread 连续触发 > MAX_AGENT_CONSECUTIVE_TRIGGERS → 停止
 */

import type { Database } from 'better-sqlite3';
import type { Agent, ChatMessage, MessageMetadata, SystemEvent } from '@slark/shared';
import {
  LOCAL_USER_ID,
  MAX_AGENT_CONSECUTIVE_TRIGGERS,
  MAX_CHAIN_DEPTH,
  MAX_MENTIONS_PER_MESSAGE,
} from '@slark/shared';
import { agentRepo, messageRepo, taskRepo } from '../db/repos.js';
import { hub } from '../ws/hub.js';
import { triggerAgent } from '../agents/engine.js';
import { parseMentions } from './mentions.js';

export interface MessageRouterDeps {
  db: Database;
  logger: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
}

export interface RouteUserMessageInput {
  channelId: string;
  content: string;
  /** 若在 Thread 内回复 */
  threadId?: string;
  /** 同时创建任务 */
  asTask?: boolean;
}

/**
 * 处理用户发送的消息（来自 WebSocket send_message）
 */
export async function routeUserMessage(
  input: RouteUserMessageInput,
  deps: MessageRouterDeps,
): Promise<void> {
  const { db, logger } = deps;
  const { channelId, content, threadId, asTask } = input;

  if (!content.trim()) return;

  // 1. 解析 @mention
  const mentions = parseMentions(content);
  const mentionsInChannel = await resolveMentionsToAgents(
    db,
    channelId,
    mentions.map((m) => m.name),
  );

  // 2. 落库 user message
  const metadata: MessageMetadata = {
    mentions: mentions.map((m) => ({
      name: m.name,
      agent_id: mentionsInChannel.find((a) => a.name === m.name)?.id ?? null,
    })),
    chain_depth: 0,
  };
  const userMsg = messageRepo.create(db, {
    channel_id: channelId,
    sender_type: 'user',
    sender_id: LOCAL_USER_ID,
    content,
    metadata,
    parent_id: threadId ?? null,
  });

  // 2b. 如果 as_task=true，基于此消息建一个 task
  if (asTask) {
    const title = content.replace(/\s+/g, ' ').trim().slice(0, 200);
    const firstMention = mentionsInChannel[0];
    const task = taskRepo.create(db, {
      channel_id: channelId,
      title,
      assignee_agent_id: firstMention?.id ?? null,
      created_by: LOCAL_USER_ID,
      source_message_id: userMsg.id,
    });
    const sysContent = `📝 1 new task created: #${task.id} "${task.title}"`;
    const sysMsg = messageRepo.create(db, {
      channel_id: channelId,
      sender_type: 'system',
      sender_id: LOCAL_USER_ID,
      content: sysContent,
      metadata: {
        system_event: { type: 'task_created', task_id: task.id, title: task.title },
        task_ref: {
          id: task.id,
          title: task.title,
          status: task.status,
          assignee_agent_id: task.assignee_agent_id,
        },
      },
      parent_id: threadId ?? null,
    });
    hub.broadcast(channelId, { type: 'message', message: sysMsg });
    hub.broadcast(channelId, { type: 'task_update', task });
  }

  // 3. 广播
  hub.broadcast(channelId, { type: 'message', message: userMsg });

  // 4. 触发被 @mention 的 agents（并发）
  if (mentionsInChannel.length === 0) {
    logger.info(`[router] no agent mentions in message ${userMsg.id}`);
    return;
  }

  if (mentionsInChannel.length > MAX_MENTIONS_PER_MESSAGE) {
    logger.warn(
      `[router] message has ${mentionsInChannel.length} mentions, truncating to ${MAX_MENTIONS_PER_MESSAGE}`,
    );
    mentionsInChannel.length = MAX_MENTIONS_PER_MESSAGE;
  }

  // Thread 策略（与 slock.ai 对齐）：
  //   - 用户消息在 thread 内 @mention → agent 回复在同 thread
  //   - 用户消息在主线 @mention       → agent 回复**也在主线**（不创建 thread）
  //   - Thread 只在链式触发（agent 回复里 @mention）时由 safeTriggerChain 创建
  const replyParentId: string | undefined = threadId;

  await Promise.all(
    mentionsInChannel.map((agent) =>
      safeTriggerChain(
        agent,
        {
          channelId,
          triggerMessage: userMsg,
          parentMessageId: replyParentId,
          chainDepth: 1,
        },
        deps,
      ),
    ),
  );
}

/**
 * 触发 agent 并处理其回复中的 @mention（链式）
 * 自带防护：深度与连续触发限制
 */
async function safeTriggerChain(
  agent: Agent,
  ctx: {
    channelId: string;
    triggerMessage: ChatMessage;
    parentMessageId?: string;
    chainDepth: number;
  },
  deps: MessageRouterDeps,
): Promise<void> {
  const { db, logger } = deps;

  // 深度检查
  if (ctx.chainDepth > MAX_CHAIN_DEPTH) {
    logger.warn(`[router] chain depth ${ctx.chainDepth} exceeds max, stopping`);
    emitSystemMessage(db, ctx.channelId, ctx.parentMessageId ?? null, {
      type: 'chain_limit_reached',
      channel_id: ctx.channelId,
      detail: `Chain depth limit (${MAX_CHAIN_DEPTH}) reached`,
    });
    return;
  }

  // 同 agent 连续触发检查（仅在 thread 内检查）
  // 策略：静默忽略（不 emit warning message），让 LLM 的"礼貌 @mention"不再污染聊天
  if (ctx.parentMessageId) {
    const thread = messageRepo.listThread(db, ctx.parentMessageId);
    const recentAgentMsgs = thread.slice(-MAX_AGENT_CONSECUTIVE_TRIGGERS * 2).filter(
      (m) => m.sender_type === 'agent' && m.sender_id === agent.id,
    );
    if (recentAgentMsgs.length >= MAX_AGENT_CONSECUTIVE_TRIGGERS) {
      logger.warn(
        `[router] skipping ${agent.name}: already triggered ${recentAgentMsgs.length}x in this thread (likely a politeness loop)`,
      );
      // 静默 return，不产出系统消息 — 让循环自然终止而不污染聊天
      return;
    }
  }

  // 调用 Engine
  const result = await triggerAgent(agent.id, ctx, { db, logger });

  if (!result.ok || !result.fullText) return;

  // 解析 agent 回复中的 @mention → 链式触发
  const replyMentions = parseMentions(result.fullText);
  if (replyMentions.length === 0) return;

  const nextAgents = await resolveMentionsToAgents(
    db,
    ctx.channelId,
    replyMentions.map((m) => m.name),
  );

  // 排除自己（避免 A @A 死循环第一层）
  const nextTargets = nextAgents.filter((a) => a.id !== agent.id);

  if (nextTargets.length === 0) return;

  logger.info(
    `[router] chain: ${agent.name} mentioned ${nextTargets.map((a) => a.name).join(', ')} (depth=${ctx.chainDepth + 1})`,
  );

  // Thread 升级策略：
  //   - 如果当前已在 thread 内 (ctx.parentMessageId !== undefined) → 保持同 thread
  //   - 否则（主线直接回复，链式触发要进 thread）→ 把 agent 的主线消息作为 thread 根
  const nextParentId =
    ctx.parentMessageId ?? result.agentReplyMessage.id;

  await Promise.all(
    nextTargets
      .slice(0, MAX_MENTIONS_PER_MESSAGE)
      .map((next) =>
        safeTriggerChain(
          next,
          {
            channelId: ctx.channelId,
            triggerMessage: result.agentReplyMessage,
            parentMessageId: nextParentId,
            chainDepth: ctx.chainDepth + 1,
          },
          deps,
        ),
      ),
  );
}

async function resolveMentionsToAgents(
  db: Database,
  channelId: string,
  names: string[],
): Promise<Agent[]> {
  if (names.length === 0) return [];
  const channelAgents = agentRepo.listInChannel(db, channelId);
  const byName = new Map(channelAgents.map((a) => [a.name.toLowerCase(), a]));
  const result: Agent[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const agent = byName.get(n.toLowerCase());
    if (agent && !seen.has(agent.id)) {
      seen.add(agent.id);
      result.push(agent);
    }
  }
  return result;
}

function emitSystemMessage(
  db: Database,
  channelId: string,
  parentId: string | null,
  event: SystemEvent,
): void {
  const content =
    event.type === 'chain_limit_reached' ? `⚠ ${event.detail}` : `System event: ${event.type}`;
  const metadata: MessageMetadata = {
    system_event:
      event.type === 'chain_limit_reached'
        ? { type: 'chain_limit_reached', detail: event.detail }
        : undefined,
  };
  const sysMsg = messageRepo.create(db, {
    channel_id: channelId,
    sender_type: 'system',
    sender_id: LOCAL_USER_ID,
    content,
    metadata,
    parent_id: parentId,
  });
  hub.broadcast(channelId, { type: 'message', message: sysMsg });
  hub.broadcast(channelId, { type: 'system_event', event });
}
