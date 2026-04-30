/**
 * Team Architect — 首个 System Agent（Sprint 1 CP4 / D-15 / D-19）
 *
 * 职责：根据用户填写的 Project Goal，推导推荐的 AI 团队（3~5 个 Agent）。
 *
 * 实现：复用 CursorAdapter spawn 一次，内置 description 模板，严格 JSON 输出。
 *
 * 兜底（Q-2 + Review 5）：任一情况走固定三件套 Architect + Dev + Reviewer：
 *   - cursor-agent 未安装
 *   - spawn 超时（独立 TEAM_ARCHITECT_TIMEOUT_MS = 30s）
 *   - 返回内容非 JSON / 解析失败 / 字段缺失
 */

import { TEAM_ARCHITECT_TIMEOUT_MS } from '@slark/shared';
import type { TeamSuggestion, TeamSuggestionAgent } from '@slark/shared';
import { createCursorAdapter } from '../agents/adapter-factory.js';
import { runWithAdapter } from '../agents/runner.js';

// =============================================================================
// 公共接口
// =============================================================================

export interface SuggestTeamInput {
  goal: string;
  workspace_path: string;
  /** 可选的 workspace 技术栈提示（package.json / Cargo.toml / pyproject.toml 等推导） */
  workspace_hint?: {
    stack?: string;
    readme_excerpt?: string;
  };
}

export async function suggestTeam(input: SuggestTeamInput): Promise<TeamSuggestion> {
  const adapter = createCursorAdapter();

  // 1. 预检查：cursor backend 是否可用（cursor-agent / SDK 二选一，由环境变量决定）
  const install = await adapter.checkInstallation();
  if (!install.installed) {
    return fallbackTeam(
      `${adapter.name} not available${install.error ? `: ${install.error}` : ''}`,
    );
  }

  // 2. spawn
  //
  // 注意：Team Architect **不传 workingDirectory** 到 cursor-agent。
  // 原因：Create Project Step 1 时用户填的 workspace_path 可能还不存在
  // （例如准备新建一个目录作为 Project 的代码仓库）；把它作为 cwd 会让
  // spawn 立刻失败。Team Architect 只需要根据 goal + workspace_path 字符串
  // 给出推荐，不需要实际读取项目文件 —— prompt 内部已包含 workspace_path
  // 作为上下文信息，spawn cwd 留给 Node.js 默认值（process.cwd()）即可。
  const prompt = buildTeamArchitectPrompt(input);

  try {
    const result = await runWithAdapter(
      adapter,
      { prompt, permissive: false },
      { timeoutMs: TEAM_ARCHITECT_TIMEOUT_MS },
    );

    if (result.timedOut) {
      return fallbackTeam('Team Architect spawn timed out');
    }
    if (result.aborted) {
      return fallbackTeam('Team Architect spawn aborted');
    }
    if (result.events.some((e) => e.type === 'error')) {
      const err = result.events.find((e) => e.type === 'error');
      const errMsg =
        err && err.type === 'error' ? err.message : 'Team Architect CLI error';
      return fallbackTeam(errMsg);
    }

    const parsed = parseTeamSuggestion(result.fullText);
    if (!parsed) {
      return fallbackTeam('Team Architect returned unparseable output');
    }
    return { ...parsed, is_fallback: false };
  } catch (e) {
    return fallbackTeam(`Team Architect spawn failed: ${(e as Error).message}`);
  }
}

// =============================================================================
// Prompt 构造
// =============================================================================

function buildTeamArchitectPrompt(input: SuggestTeamInput): string {
  const hintBlock = input.workspace_hint
    ? `\n\nWorkspace hint:\n${input.workspace_hint.stack ? `- Stack: ${input.workspace_hint.stack}` : ''}${
        input.workspace_hint.readme_excerpt
          ? `\n- README excerpt: ${input.workspace_hint.readme_excerpt.slice(0, 300)}`
          : ''
      }`
    : '';

  return [
    'You are the Team Architect for a new AI engineering team in Slark (a local AI Team OS).',
    '',
    'Given a project goal and workspace path, recommend a small focused team of 3 to 5 AI agents with clear roles.',
    'Typical shapes: Architect + Dev + Reviewer, or a richer mix for specific domains.',
    '',
    `Project goal: ${input.goal}`,
    `Workspace path: ${input.workspace_path}`,
    hintBlock,
    '',
    'Reply with STRICT JSON ONLY. No markdown fences, no commentary, no prose.',
    'Schema:',
    '{',
    '  "agents": [',
    '    {',
    '      "name": "Architect",               // short, PascalCase or kebab-case',
    '      "role": "Architect",                // one-word role label',
    '      "description": "...",               // 1-3 sentences, written as the agent\'s system prompt in second person',
    '      "runtime": "cursor",                // always "cursor" for MVP',
    '      "model": "composer-2-fast",         // default',
    '      "reasoning": "medium"               // low / medium / high / xhigh',
    '    }',
    '  ],',
    '  "rationale": "one paragraph explaining why this team fits the goal"',
    '}',
    '',
    'Return JSON ONLY.',
  ].join('\n');
}

// =============================================================================
// JSON 解析 + 兜底
// =============================================================================

function parseTeamSuggestion(raw: string): Omit<TeamSuggestion, 'is_fallback'> | null {
  const cleaned = stripJSONFences(raw).trim();
  if (!cleaned) return null;

  // 尝试找到第一个 { ... } 对象
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last <= first) return null;
  const candidate = cleaned.slice(first, last + 1);

  let obj: unknown;
  try {
    obj = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;

  const agentsRaw = o.agents;
  if (!Array.isArray(agentsRaw) || agentsRaw.length === 0) return null;

  const agents: TeamSuggestionAgent[] = [];
  for (const ag of agentsRaw) {
    if (!ag || typeof ag !== 'object') continue;
    const a = ag as Record<string, unknown>;
    const name = typeof a.name === 'string' ? a.name.trim() : '';
    const role = typeof a.role === 'string' ? a.role.trim() : '';
    const description = typeof a.description === 'string' ? a.description.trim() : '';
    if (!name || !description) continue;

    const runtime = typeof a.runtime === 'string' ? a.runtime.trim() : 'cursor';
    const model = typeof a.model === 'string' ? a.model.trim() : 'composer-2-fast';
    const reasoningRaw = typeof a.reasoning === 'string' ? a.reasoning.trim() : 'medium';
    const reasoning =
      reasoningRaw === 'low' ||
      reasoningRaw === 'medium' ||
      reasoningRaw === 'high' ||
      reasoningRaw === 'xhigh'
        ? reasoningRaw
        : 'medium';

    // 只接受 'cursor' 或 '' 作为 MVP runtime；其他置 'cursor'
    const runtimeNormalized = runtime === 'cursor' ? 'cursor' : 'cursor';

    agents.push({
      name,
      role: role || name,
      description,
      runtime: runtimeNormalized,
      model: model || 'composer-2-fast',
      reasoning,
    });
  }

  if (agents.length === 0) return null;

  const rationale = typeof o.rationale === 'string' ? o.rationale.trim() : '';

  return { agents, rationale };
}

/** 去掉 assistant 有时会加的 ```json ... ``` 包裹 */
function stripJSONFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return match ? match[1] ?? '' : text;
}

// =============================================================================
// 兜底三件套（Q-2 / Review 5）
// =============================================================================

const FALLBACK_ARCHITECT: TeamSuggestionAgent = {
  name: 'Architect',
  role: 'Architect',
  description:
    'You design APIs, data models, and module boundaries. Before proposing a solution, skim the codebase to understand existing conventions. Focus on clarity and maintainability over cleverness.',
  runtime: '',
  model: '',
  reasoning: 'medium',
};

const FALLBACK_DEV: TeamSuggestionAgent = {
  name: 'Dev',
  role: 'Developer',
  description:
    'You implement features based on the Architect\'s design. Write clean, typed code with tests. Always wrap async calls in try/catch and surface errors with structured context.',
  runtime: '',
  model: '',
  reasoning: 'medium',
};

const FALLBACK_REVIEWER: TeamSuggestionAgent = {
  name: 'Reviewer',
  role: 'Reviewer',
  description:
    'You review code for correctness, security, and maintainability. Call out issues directly and suggest concrete fixes. Do not rubber-stamp; push back when something feels off.',
  runtime: '',
  model: '',
  reasoning: 'medium',
};

function fallbackTeam(reason: string): TeamSuggestion {
  return {
    agents: [FALLBACK_ARCHITECT, FALLBACK_DEV, FALLBACK_REVIEWER],
    rationale:
      'Default team (Team Architect unavailable). Please configure runtime/model for each agent before use.',
    is_fallback: true,
    fallback_reason: reason,
  };
}
