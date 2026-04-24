/**
 * Sidebar — 黄背景 + 粉色 active 项
 * 参考: docs/ui-reference/screenshots/10-channel-main-desktop.png
 *
 * 当前 MVP 简化（见 local-adaptations.md）:
 *   - Server 下拉简化为静态 "Slark" 标签
 *   - 无 Invite human、无 Plan & Billing 等多用户 UI
 *   - Search / Threads / Tasks / Saved 项展示但未实装（click = no-op）
 */

import { useEffect, useRef, useState } from 'react';
import { NavLink, useSearchParams, useNavigate } from 'react-router-dom';
import type { Agent, Channel, Project } from '@slark/shared';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { StatusDot } from './StatusDot';

interface Props {
  channels: Channel[];
  agents: Agent[];
  projects: Project[];
  currentProject: Project | null;
  onSelectProject: (id: string | null) => void;
  onCreateProject?: () => void;
  currentChannelId?: string;
  currentDmAgentId?: string;
  onCreateChannel?: () => void;
  onCreateAgent?: () => void;
  onOpenSearch?: () => void;
}

export function Sidebar({
  channels,
  agents,
  projects,
  currentProject,
  onSelectProject,
  onCreateProject,
  currentChannelId,
  currentDmAgentId,
  onCreateChannel,
  onCreateAgent,
  onOpenSearch,
}: Props) {
  const [params] = useSearchParams();
  const sidebarTab = (params.get('sidebarTab') ?? 'chat') as 'chat' | 'members';
  const navigate = useNavigate();

  const setTab = (tab: 'chat' | 'members') => {
    const next = new URLSearchParams(params);
    next.set('sidebarTab', tab);
    navigate({ search: `?${next.toString()}` });
  };

  return (
    <aside className="w-64 bg-bg-sidebar border-r-2 border-black flex flex-col h-full">
      {/* Project 切换器（v1.0 CP5b，替换原静态 "Slark" 标签，对齐原版 KaisTeam ▼） */}
      <ProjectSwitcher
        projects={projects}
        currentProject={currentProject}
        onSelect={onSelectProject}
        onCreate={onCreateProject}
      />


      {/* Tab 切换 */}
      <div className="flex border-y-2 border-black">
        <TabButton active={sidebarTab === 'chat'} onClick={() => setTab('chat')}>
          {/* Chat 图标 */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </TabButton>
        <TabButton active={sidebarTab === 'members'} onClick={() => setTab('members')}>
          {/* Members 图标 */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </TabButton>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sidebarTab === 'chat' ? (
          <ChatTabContent
            channels={channels}
            agents={agents}
            currentChannelId={currentChannelId}
            currentDmAgentId={currentDmAgentId}
            onCreateChannel={onCreateChannel}
            onOpenSearch={onOpenSearch}
          />
        ) : (
          <MembersTabContent agents={agents} onCreateAgent={onCreateAgent} />
        )}
      </div>

      {/* 底部 user zone (本地版简化) */}
      <div className="border-t-2 border-black p-2 flex items-center gap-2 bg-bg-sidebar">
        <Avatar name="Local" kind="user" size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">Local User</div>
          <div className="text-[10px] text-text-secondary font-mono truncate">~/.slark</div>
        </div>
        <button
          className="p-1 hover:bg-bg-main rounded border-2 border-transparent hover:border-black"
          title="Settings (coming soon)"
          aria-label="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </aside>
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
        'flex-1 flex items-center justify-center py-2 border-r-2 border-black last:border-r-0',
        active ? 'bg-bg-card' : 'hover:bg-[#f5c830]',
      )}
    >
      {children}
    </button>
  );
}

function SectionHeader({
  label,
  count,
  onAdd,
}: {
  label: string;
  count?: number;
  onAdd?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-1">
      <div className="flex items-center gap-1">
        <span className="section-header">▼ {label}</span>
        {typeof count === 'number' && (
          <span className="text-[11px] font-mono text-text-secondary">{count}</span>
        )}
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="w-5 h-5 flex items-center justify-center border-2 border-black rounded bg-bg-card hover:bg-accent-yellow text-xs font-bold"
          title={`Add ${label.toLowerCase()}`}
          aria-label={`Add ${label.toLowerCase()}`}
        >
          +
        </button>
      )}
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  rightSlot,
  active,
}: {
  to: string;
  icon?: React.ReactNode;
  label: React.ReactNode;
  rightSlot?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm',
          'border-2 mx-2 my-0.5 rounded',
          active || isActive
            ? 'bg-accent-pink border-black font-medium'
            : 'border-transparent hover:bg-[#f5c830] hover:border-black',
        )
      }
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {rightSlot}
    </NavLink>
  );
}

function ChatTabContent({
  channels,
  agents,
  currentChannelId,
  currentDmAgentId,
  onCreateChannel,
  onOpenSearch,
}: {
  channels: Channel[];
  agents: Agent[];
  currentChannelId?: string;
  currentDmAgentId?: string;
  onCreateChannel?: () => void;
  onOpenSearch?: () => void;
}) {
  const publicChannels = channels.filter((c) => c.type === 'channel');

  return (
    <div className="pb-3">
      {/* 工具行 */}
      <div className="px-3 pt-3 space-y-0.5">
        <ToolButton icon={<SearchIcon />} label="Search" rightText="⌘K" onClick={onOpenSearch} />
        <ToolLink icon={<ThreadIcon />} label="Threads" to="/threads" />
        <ToolLink icon={<TaskIcon />} label="Tasks" to="/tasks" />
        <ToolLink icon={<BookmarkIcon />} label="Saved" to="/saved" />
      </div>

      {/* CHANNELS */}
      <SectionHeader label="CHANNELS" count={publicChannels.length} onAdd={onCreateChannel} />
      {publicChannels.map((ch) => (
        <NavItem
          key={ch.id}
          to={`/channel/${ch.id}`}
          icon={<span className="font-bold">#</span>}
          label={ch.name}
          active={currentChannelId === ch.id}
        />
      ))}

      {/* DIRECT MESSAGES */}
      <SectionHeader label="DIRECT MESSAGES" count={agents.length} />
      {agents.map((a) => (
        <NavItem
          key={a.id}
          to={`/dm/${a.id}`}
          icon={<Avatar name={a.name} kind="agent" size="sm" />}
          label={
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium truncate">{a.name}</span>
              {a.description && (
                <span className="text-[11px] font-mono text-text-secondary truncate">
                  {a.description}
                </span>
              )}
            </span>
          }
          rightSlot={<StatusDot status={a.status} size="xs" />}
          active={currentDmAgentId === a.id}
        />
      ))}
    </div>
  );
}

function MembersTabContent({
  agents,
  onCreateAgent,
}: {
  agents: Agent[];
  onCreateAgent?: () => void;
}) {
  return (
    <div className="pb-3">
      <SectionHeader label="AGENTS" count={agents.length} onAdd={onCreateAgent} />
      {agents.map((a) => (
        <NavItem
          key={a.id}
          to={`/agent/${a.id}`}
          icon={<Avatar name={a.name} kind="agent" size="sm" />}
          label={
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="font-medium truncate">{a.name}</span>
              {a.description && (
                <span className="text-[11px] font-mono text-text-secondary truncate">
                  {a.description}
                </span>
              )}
            </span>
          }
          rightSlot={<StatusDot status={a.status} size="xs" />}
        />
      ))}
      {agents.length === 0 && (
        <div className="px-3 py-2 text-xs text-text-secondary font-mono">
          No agents yet. Click + to create.
        </div>
      )}
      {/* 本地版去掉 HUMANS / MACHINES sections */}
    </div>
  );
}

function ToolButton({
  icon,
  label,
  rightText,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  rightText?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-[#f5c830]"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate text-left">{label}</span>
      {rightText && <span className="text-[11px] font-mono text-text-muted">{rightText}</span>}
    </button>
  );
}

function ToolLink({
  icon,
  label,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 px-2 py-1 text-sm rounded',
          isActive ? 'bg-accent-pink border-2 border-black' : 'hover:bg-[#f5c830]',
        )
      }
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </NavLink>
  );
}

// ---------- Project Switcher (v1.0 CP5b) ----------
function ProjectSwitcher({
  projects,
  currentProject,
  onSelect,
  onCreate,
}: {
  projects: Project[];
  currentProject: Project | null;
  onSelect: (id: string | null) => void;
  onCreate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDoc);
    return () => window.removeEventListener('mousedown', onDoc);
  }, [open]);

  const label = currentProject?.display_name ?? currentProject?.name ?? 'Slark';

  return (
    <div className="relative px-3 pt-3 pb-2" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-2 py-1.5 bg-black text-accent-yellow font-bold rounded flex items-center justify-between gap-1 border-2 border-black hover:brightness-110"
        title={currentProject?.workspace_path ?? 'No project selected'}
      >
        <span className="truncate">{label}</span>
        <span className="text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute left-3 right-3 mt-1 z-40 bg-bg-card border-2 border-black rounded shadow-[4px_4px_0_0_#000]">
          <div className="max-h-64 overflow-y-auto">
            {projects.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-text-secondary font-mono">
                No projects yet
              </div>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-accent-yellow flex items-center justify-between gap-2',
                  currentProject?.id === p.id ? 'bg-accent-pink font-bold' : '',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.display_name ?? p.name}</div>
                  <div className="text-[10px] font-mono text-text-secondary truncate">
                    {p.workspace_path}
                  </div>
                </div>
                {currentProject?.id === p.id && <span>✓</span>}
              </button>
            ))}
          </div>
          {onCreate && (
            <button
              type="button"
              onClick={() => {
                onCreate();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm border-t-2 border-black bg-accent-pink font-bold hover:brightness-105"
            >
              + New Project
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Icons (inline SVG to avoid dependency) ----------
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function ThreadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function TaskIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function BookmarkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
