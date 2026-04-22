import { create } from 'zustand';
import type { Agent, AgentStatus } from '@slark/shared';
import { listAgents } from '../lib/api';

interface AgentsState {
  agents: Agent[];
  loaded: boolean;
  refresh: () => Promise<void>;
  upsert: (agent: Agent) => void;
  remove: (id: string) => void;
  setStatus: (agentId: string, status: AgentStatus) => void;
  getById: (id: string) => Agent | undefined;
}

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: [],
  loaded: false,
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
  remove: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
  setStatus: (agentId, status) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === agentId ? { ...a, status } : a)),
    })),
  getById: (id) => get().agents.find((a) => a.id === id),
}));
