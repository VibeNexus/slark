/**
 * ContextBuilder — 为 Agent 构建 CLI 输入 prompt
 *
 * 输入（按 D-4 token 预算）:
 *   1. Agent description (system prompt)    → DESCRIPTION_BUDGET
 *   2. 团队成员列表（可 @mention 谁）         → 通常很短，含在 description 里
 *   3. 对话历史（按 channel / thread）        → HISTORY_BUDGET
 *   4. 当前触发消息                           → CURRENT_MESSAGE_BUDGET
 *
 * Token 估算用 "4 字符 ≈ 1 token" 粗估（避免引入 tokenizer 依赖）
 */

import {
  CHARS_PER_TOKEN,
  DESCRIPTION_BUDGET,
  HISTORY_BUDGET,
} from '@slark/shared';
import type { Agent, ChatMessage } from '@slark/shared';

export interface BuildContextInput {
  /** 被触发的目标 agent */
  targetAgent: Agent;
  /** 同频道内其他 Agent（team 成员列表） */
  teamAgents: Agent[];
  /** 历史消息（最新在最后） */
  history: ChatMessage[];
  /** 当前触发此 agent 的消息（包含 @mention） */
  triggerMessage: ChatMessage;
  /** 用户显示名 */
  localUserName?: string;
}

export interface BuiltContext {
  prompt: string;
  estimatedTokens: number;
}

const tokensOf = (s: string): number => Math.ceil(s.length / CHARS_PER_TOKEN);

export function buildContext(input: BuildContextInput): BuiltContext {
  const { targetAgent, teamAgents, history, triggerMessage, localUserName = 'User' } = input;

  // === 1. Agent description（system prompt）===
  let description = targetAgent.description?.trim() ?? '';
  if (!description) {
    description = `You are ${targetAgent.name}, a helpful AI assistant.`;
  }
  description = truncateMiddle(description, DESCRIPTION_BUDGET * CHARS_PER_TOKEN);

  // === 2. 团队成员列表 ===
  const others = teamAgents.filter((a) => a.id !== targetAgent.id);
  const teamLines =
    others.length > 0
      ? [
          '',
          'Available team members (use @mention ONLY if you need them to take concrete action):',
          ...others.map((a) => {
            const role = a.description
              ? a.description.split(/[。.\n]/)[0]?.slice(0, 50) ?? ''
              : '';
            return `  - @${a.name}${role ? ` — ${role}` : ''}`;
          }),
        ].join('\n')
      : '';

  // === 3. 对话历史 ===
  const historyLines = buildHistoryLines(history, localUserName);
  const historyBudgetChars = HISTORY_BUDGET * CHARS_PER_TOKEN;
  const trimmedHistory = trimHistoryFromEnd(historyLines, historyBudgetChars);

  // === 4. 当前触发消息 ===
  const senderLabel =
    triggerMessage.sender_type === 'agent'
      ? `@${teamAgents.find((a) => a.id === triggerMessage.sender_id)?.name ?? 'Agent'}`
      : localUserName;
  const triggerLine = `[${senderLabel}] ${triggerMessage.content}`;

  // === 拼接最终 prompt ===
  const sections = [
    `## Your role`,
    description,
    teamLines,
    '',
    '## Conversation history',
    trimmedHistory.length > 0 ? trimmedHistory.join('\n') : '(no prior messages)',
    '',
    '## Current message (please respond to this)',
    triggerLine,
    '',
    '## Response guidelines',
    `- Respond as ${targetAgent.name}. Be concise and focused on the user's intent.`,
    `- Do NOT @mention other agents for politeness, greetings, acknowledgments, or self-introductions.`,
    `- Only @mention another agent when you explicitly need them to perform a concrete task or review.`,
    `- Never @mention the user to keep the conversation going — stop when you've answered.`,
    `- If you have nothing new to add or the conversation is resolved, keep your reply short and do not @mention anyone.`,
  ];

  const prompt = sections.filter((s) => s !== '').join('\n');

  return {
    prompt,
    estimatedTokens: tokensOf(prompt),
  };
}

function buildHistoryLines(history: ChatMessage[], localUserName: string): string[] {
  return history.map((m) => {
    let speaker: string;
    if (m.sender_type === 'user') speaker = localUserName;
    else if (m.sender_type === 'system') speaker = 'system';
    else speaker = `Agent:${m.sender_id ?? 'unknown'}`;
    return `[${speaker}] ${m.content}`;
  });
}

/** 从尾部开始保留消息，直到累计字符数接近预算 */
function trimHistoryFromEnd(lines: string[], budgetChars: number): string[] {
  const result: string[] = [];
  let used = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    const cost = line.length + 1; // \n
    if (used + cost > budgetChars) break;
    result.unshift(line);
    used += cost;
  }
  return result;
}

function truncateMiddle(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  const keep = Math.floor((maxChars - 3) / 2);
  return s.slice(0, keep) + '...' + s.slice(s.length - keep);
}
