import { create } from 'zustand';
import type { Agent, AgentRunStatus, AgentStatus } from '@slark/shared';
import { listAgents } from '../lib/api';

/**
 * Agents store
 *
 * v1.0 CP8.3：agents.status 字段已从 schema 移除；状态完全由 agent_runs 派生。
 * Per-channel run 状态来自 WebSocket `agent_status` 事件（含 channel_id）。
 *
 * - `runByAgentChannel`: Map<agent_id, Map<channel_id, AgentRunStatus>>
 * - `getDerivedStatus(agentId)`: 任意活跃 run 优先（working > thinking > error > stopped）；否则 'idle'
 * - `getChannelRunStatus(agentId, channelId)`: 该 channel 当前 run 状态（无活跃 run 返回 undefined）
 */

interface AgentsState {
  agents: Agent[];
  loaded: boolean;
  /** Per-channel 活跃 run 状态：Map<agent_id, Map<channel_id, status>> */
  runByAgentChannel: Map<string, Map<string, AgentRunStatus>>;

  refresh: () => Promise<void>;
  upsert: (agent: Agent) => void;
  remove: (id: string) => void;
  setChannelRunStatus: (agentId: string, channelId: string, status: AgentRunStatus) => void;
  clearChannelRun: (agentId: string, channelId: string) => void;
  /** 是否有任意活跃 run（thinking / working） */
  isAgentActive: (agentId: string) => boolean;
  /** 派生该 agent 的展示状态（任意活跃 run 优先；否则 'idle'） */
  getDerivedStatus: (agentId: string) => AgentStatus;
  /** 该 agent 在指定 channel 的 run 状态（无活跃 run 返回 undefined） */
  getChannelRunStatus: (agentId: string, channelId: string) => AgentRunStatus | undefined;
  getById: (id: string) => Agent | undefined;
}

const RUN_PRIORITY: AgentRunStatus[] = ['working', 'thinking', 'error', 'stopped'];

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  loaded: false,
  runByAgentChannel: new Map(),

  refresh: async () => {
    const agents = await listAgents();
    set({ agents, loaded: true });
  },
  upsert: (agent) =>
    set((s) => {
      const idx = s.agents.findIndex((a) => a.id === agent.id);
      if (idx >= 0) {
        const next = [...s.agents];
        next[idx] = agent;
        return { agents: next };
      }
      return { agents: [...s.agents, agent] };
    }),
  remove: (id) =>
    set((s) => {
      const nextMap = new Map(s.runByAgentChannel);
      nextMap.delete(id);
      return {
        agents: s.agents.filter((a) => a.id !== id),
        runByAgentChannel: nextMap,
      };
    }),

  setChannelRunStatus: (agentId, channelId, status) =>
    set((s) => {
      const nextMap = new Map(s.runByAgentChannel);
      const inner = new Map(nextMap.get(agentId) ?? new Map<string, AgentRunStatus>());
      inner.set(channelId, status);
      nextMap.set(agentId, inner);
      return { runByAgentChannel: nextMap };
    }),

  clearChannelRun: (agentId, channelId) =>
    set((s) => {
      const inner = s.runByAgentChannel.get(agentId);
      if (!inner || !inner.has(channelId)) return {};
      const nextMap = new Map(s.runByAgentChannel);
      const nextInner = new Map(inner);
      nextInner.delete(channelId);
      if (nextInner.size === 0) nextMap.delete(agentId);
      else nextMap.set(agentId, nextInner);
      return { runByAgentChannel: nextMap };
    }),

  isAgentActive: (agentId) => {
    const inner = get().runByAgentChannel.get(agentId);
    if (!inner) return false;
    for (const s of inner.values()) {
      if (s === 'thinking' || s === 'working') return true;
    }
    return false;
  },

  getDerivedStatus: (agentId) => {
    const inner = get().runByAgentChannel.get(agentId);
    if (!inner || inner.size === 0) return 'idle';
    let bestIdx = RUN_PRIORITY.length;
    let best: AgentStatus = 'idle';
    for (const s of inner.values()) {
      const idx = RUN_PRIORITY.indexOf(s);
      if (idx >= 0 && idx < bestIdx) {
        bestIdx = idx;
        best = s;
      }
    }
    return best;
  },

  getChannelRunStatus: (agentId, channelId) => {
    return get().runByAgentChannel.get(agentId)?.get(channelId);
  },

  getById: (id) => get().agents.find((a) => a.id === id),
}));
