/**
 * Agent Profile 右侧面板
 * 参考: docs/ui-reference/screenshots/40-agent-profile-desktop.png + 41-agent-profile-actions.png
 *
 * v1.0 修订（Sprint 1 CP6 / D-8）：
 *   - 从原版 3 Tab 简化为 2 Tab：PROFILE / ACTIVITY
 *   - 删除 WORKSPACE Tab（Slark 不再提供 Agent 独立 workspace；
 *     项目代码由 project.workspace_path 承载，Agent 无私人沙盒展示位）
 *   - FEEDBACK Tab 将在 Sprint 5 Evolution Loop 上线作为第 3 Tab
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Agent, AgentActivity } from '@slark/shared';
import { cn } from '../lib/cn';
import {
  deleteAgent,
  getAgentActivity,
  restartAgent,
  startAgent,
  stopAgent,
  updateAgent,
} from '../lib/api';
import { useAgentsStore } from '../stores/agents';
import { Avatar } from './Avatar';
import { StatusDot, statusLabel } from './StatusDot';
import { InlineEdit } from './InlineEdit';

interface Props {
  agent: Agent;
}

type TabKey = 'profile' | 'activity';

export function AgentProfilePanel({ agent }: Props) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = (params.get('agentTab') ?? 'profile') as TabKey;
  const removeFromStore = useAgentsStore((s) => s.remove);

  const setTab = (t: TabKey) => {
    const next = new URLSearchParams(params);
    next.set('agentTab', t);
    setParams(next);
  };

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('profile');
    next.delete('agentTab');
    setParams(next);
  };

  const actionHandlers = {
    start: () => startAgent(agent.id),
    stop: () => stopAgent(agent.id),
    restart: () => restartAgent(agent.id),
    delete: async () => {
      if (!confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) return;
      await deleteAgent(agent.id);
      removeFromStore(agent.id);
      close();
    },
    message: () => navigate(`/dm/${agent.id}`),
  };

  return (
    <aside className="w-96 border-l-2 border-black bg-bg-main flex flex-col h-full min-w-0">
      <header className="border-b-2 border-black bg-bg-card px-3 py-2 flex items-center gap-2">
        <Avatar name={agent.name} kind="agent" size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate text-sm">{agent.name}</div>
          <div className="text-[11px] font-mono text-text-secondary truncate">
            {agent.description?.split(/[\n。.]/)[0]?.slice(0, 40) ?? ''}
          </div>
        </div>
        <IconButton onClick={actionHandlers.message} title="Message">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </IconButton>
        <IconButton onClick={() => void actionHandlers.start()} title="Start Agent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </IconButton>
        <IconButton onClick={() => void actionHandlers.restart()} title="Restart / Reset">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </IconButton>
        <IconButton onClick={close} title="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </header>

      {/* 2 Tab（v1.0 CP6 简化，原 WORKSPACE Tab 已删除） */}
      <div className="flex border-b-2 border-black">
        <TabButton active={tab === 'profile'} onClick={() => setTab('profile')}>
          <ProfileIcon /> PROFILE
        </TabButton>
        <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>
          <ActivityIcon /> ACTIVITY
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'profile' && <ProfileTab agent={agent} onDelete={actionHandlers.delete} onStart={actionHandlers.start} onStop={actionHandlers.stop} onRestart={actionHandlers.restart} />}
        {tab === 'activity' && <ActivityTab agent={agent} />}
      </div>
    </aside>
  );
}

function ProfileTab({
  agent,
  onDelete,
  onStart,
  onStop,
  onRestart,
}: {
  agent: Agent;
  onDelete: () => void | Promise<void>;
  onStart: () => void | Promise<unknown>;
  onStop: () => void | Promise<unknown>;
  onRestart: () => void | Promise<unknown>;
}) {
  const upsertAgent = useAgentsStore((s) => s.upsert);

  const saveName = async (v: string) => {
    if (!v) return;
    const updated = await updateAgent(agent.id, { name: v });
    upsertAgent(updated);
  };
  const saveDescription = async (v: string) => {
    const updated = await updateAgent(agent.id, { description: v || null });
    upsertAgent(updated);
  };
  const saveEnvVars = async (v: string) => {
    const parsed = parseEnvVarsText(v);
    const updated = await updateAgent(agent.id, { env_vars: parsed });
    upsertAgent(updated);
  };

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-start gap-3">
        <Avatar name={agent.name} kind="agent" size="lg" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg">{agent.name}</div>
          <div className="flex items-center gap-2 text-sm">
            <StatusDot status={agent.status} size="xs" />
            <span className="font-mono text-text-secondary">{statusLabel(agent.status)}</span>
          </div>
          <div className="text-sm font-mono text-text-secondary mt-0.5">@{agent.name}</div>
        </div>
      </div>

      <ProfileField label="DISPLAY NAME">
        <InlineEdit value={agent.name} maxLength={80} onSave={saveName} />
      </ProfileField>

      <ProfileField label="DESCRIPTION">
        <InlineEdit
          value={agent.description ?? ''}
          multiline
          maxLength={3000}
          placeholder="No description"
          onSave={saveDescription}
        />
      </ProfileField>

      <div className="border-t-2 border-black/30 pt-4">
        <div className="section-header mb-3">INFO</div>
        <div className="flex gap-4 flex-wrap">
          <InfoTag label="Runtime" value={agent.runtime} color="teal" />
          <InfoTag label="Model" value={agent.model ?? '-'} color="purple" />
          <InfoTag label="Reasoning" value={agent.reasoning ?? '-'} color="yellow" />
        </div>
        <div className="mt-4">
          <div className="text-xs text-text-secondary font-mono">Born</div>
          <div className="text-sm">{new Date(agent.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      <ProfileField label="ENVIRONMENT VARIABLES">
        <InlineEdit
          value={envVarsToText(agent.env_vars)}
          multiline
          maxLength={5000}
          placeholder="No environment variables configured (one per line: KEY=value)"
          onSave={saveEnvVars}
          renderDisplay={(v) =>
            v ? (
              <div className="space-y-1">
                {v
                  .split('\n')
                  .filter((l) => l.trim())
                  .map((l, i) => {
                    const eq = l.indexOf('=');
                    const k = eq > 0 ? l.slice(0, eq) : l;
                    const val = eq > 0 ? l.slice(eq + 1) : '';
                    return (
                      <div key={i} className="font-mono text-xs">
                        <span className="font-bold">{k}</span>=<span>{val}</span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <span className="text-text-secondary italic text-sm">
                No environment variables configured
              </span>
            )
          }
        />
      </ProfileField>

      <div className="border-t-2 border-black/30 pt-4">
        <div className="section-header mb-3">ACTIONS</div>
        <div className="space-y-2">
          <ActionButton onClick={() => void onStart()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            Start Agent
          </ActionButton>
          <ActionButton onClick={() => void onStop()}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" /></svg>
            Stop Agent
          </ActionButton>
          <ActionButton onClick={() => void onRestart()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Restart / Reset
          </ActionButton>
          <ActionButton onClick={() => {}} variant="pink" disabled title="Coming soon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            Report Issue
          </ActionButton>
          <ActionButton onClick={() => void onDelete()} variant="red">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete Agent
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ agent }: { agent: Agent }) {
  const [items, setItems] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await getAgentActivity(agent.id);
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [agent.id]);

  if (loading && items.length === 0) {
    return <div className="p-4 text-text-secondary font-mono text-sm">Loading...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-text-secondary font-mono text-sm">
        No activity yet. Start the agent to see its activity log.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {items.map((a) => (
        <div key={a.id} className="flex gap-3 py-1 border-b border-black/10 last:border-0">
          <span className="text-[10px] font-mono text-text-secondary mt-0.5">
            {new Date(a.created_at).toLocaleTimeString()}
          </span>
          <StatusDot status={mapActivityType(a.type)} size="xs" className="mt-1.5" animated={false} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono uppercase text-text-secondary">{a.type}</div>
            <div className="text-xs">{a.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function mapActivityType(t: AgentActivity['type']): import('@slark/shared').AgentStatus {
  if (t === 'thinking') return 'thinking';
  if (t === 'working') return 'working';
  if (t === 'idle') return 'idle';
  if (t === 'error') return 'error';
  return 'idle';
}

// ---------- Building blocks ----------

function ProfileField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="section-header mb-1.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function InfoTag({ label, value, color }: { label: string; value: string; color: 'teal' | 'purple' | 'yellow' }) {
  const bg = color === 'teal' ? 'bg-accent-teal' : color === 'purple' ? 'bg-accent-purple' : 'bg-accent-yellow';
  return (
    <div>
      <div className="text-xs text-text-secondary font-mono mb-1">{label}</div>
      <span className={cn('inline-block px-2 py-1 border-2 border-black rounded font-mono text-sm', bg)}>
        {value}
      </span>
    </div>
  );
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-7 h-7 flex items-center justify-center border-2 border-black rounded hover:bg-accent-yellow"
    >
      {children}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold font-mono border-r-2 border-black last:border-r-0',
        active ? 'bg-accent-yellow' : 'hover:bg-[#f9efc8]',
      )}
    >
      {children}
    </button>
  );
}

function ActionButton({
  onClick,
  children,
  variant = 'default',
  disabled,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'pink' | 'red';
  disabled?: boolean;
  title?: string;
}) {
  const cls =
    variant === 'red'
      ? 'bg-accent-red text-black'
      : variant === 'pink'
        ? 'bg-accent-pink'
        : 'bg-bg-card';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-full py-2 px-3 flex items-center justify-center gap-2 border-2 border-black rounded font-medium',
        cls,
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-95',
      )}
    >
      {children}
    </button>
  );
}

// Env vars 文本 <-> 对象
function envVarsToText(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

function parseEnvVarsText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq < 1) continue;
    const k = s.slice(0, eq).trim();
    const v = s.slice(eq + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

// Icons
function ProfileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
