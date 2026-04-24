/**
 * Welcome 页（v1.0 重构，Sprint 1 CP5a）
 *
 * 行为：
 *   - 无 Project：显示大 CTA "Create your first Project" → 打开 CreateProjectDialog
 *   - 有 Project：简要列出 Projects / 当前 Project 的 channels / DMs（过渡态，CP5b 之后由 Sidebar 承担切换）
 *   - cursor-agent 未装时显示黄色警告条
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RuntimeDetection } from '@slark/shared';
import { getRuntimes } from '../lib/api';
import { useChannelsStore } from '../stores/channels';
import { useAgentsStore } from '../stores/agents';
import { useProjectsStore } from '../stores/projects';
import { CreateProjectDialog } from '../components/CreateProjectDialog';

export function WelcomePage() {
  const projects = useProjectsStore((s) => s.projects);
  const channels = useChannelsStore((s) => s.channels);
  const agents = useAgentsStore((s) => s.agents);
  const [runtimes, setRuntimes] = useState<RuntimeDetection[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    void getRuntimes().then(setRuntimes).catch(() => {});
  }, []);

  const cursor = runtimes.find((r) => r.id === 'cursor');
  const cursorReady = cursor?.installed;

  const noProjects = projects.length === 0;

  return (
    <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-xl w-full bg-bg-card border-2 border-black rounded-xl p-8 shadow-[6px_6px_0_0_#000]">
        <h1 className="text-3xl font-bold mb-2">Welcome to Slark</h1>
        <p className="text-text-secondary mb-6">
          Programmable AI Team OS — set a goal, AI configures a team, team designs its own workflow.
        </p>

        {!cursorReady && (
          <div className="mb-6 p-4 bg-accent-yellow border-2 border-black rounded">
            <div className="font-bold mb-1">⚠ Cursor CLI not installed</div>
            <div className="text-sm">
              Install <code className="font-mono">cursor-agent</code> from Cursor IDE. You can still
              create a project now; the Team Architect will show a default team and you can fill
              in <span className="font-mono">runtime</span> after installing Cursor CLI.
            </div>
          </div>
        )}

        {noProjects ? (
          <div className="space-y-4">
            <div className="text-sm text-text-secondary">
              No projects yet. Create one to spawn your first AI team.
            </div>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="w-full px-4 py-3 border-2 border-black rounded bg-accent-pink font-bold text-lg hover:brightness-105 shadow-[4px_4px_0_0_#000]"
            >
              + Create your first Project
            </button>
            <div className="text-[12px] font-mono text-text-muted">
              Each project binds to a code repo. You set a goal, Team Architect recommends agents,
              and you approve the team.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="section-header">PROJECTS</div>
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="px-3 py-1 text-xs font-bold border-2 border-black rounded bg-accent-pink hover:brightness-105"
              >
                + New Project
              </button>
            </div>
            <ul className="space-y-2">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="p-3 border-2 border-black rounded bg-bg-main"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold">{p.display_name ?? p.name}</div>
                    <code className="text-[11px] font-mono bg-accent-yellow px-1 rounded">
                      {p.name}
                    </code>
                  </div>
                  <div className="text-[12px] font-mono text-text-secondary truncate">
                    {p.workspace_path}
                  </div>
                  <div className="text-[12px] mt-1">{p.goal}</div>
                </li>
              ))}
            </ul>

            {channels.length > 0 && (
              <div>
                <div className="section-header mb-2">CHANNELS</div>
                <ul className="space-y-1">
                  {channels.map((c) => (
                    <li key={c.id}>
                      <Link
                        to={`/channel/${c.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-black rounded hover:bg-accent-yellow font-medium"
                      >
                        <span className="font-bold">#</span>
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {agents.length > 0 && (
              <div>
                <div className="section-header mb-2">AGENTS</div>
                <ul className="space-y-1">
                  {agents.map((a) => (
                    <li key={a.id}>
                      <Link
                        to={`/dm/${a.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-black rounded hover:bg-accent-yellow font-medium"
                      >
                        <span>{a.name}</span>
                        <span className="text-xs font-mono text-text-secondary">
                          {a.runtime} · {a.model ?? '-'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-xs text-text-muted font-mono">
          Slark v1.0 · local-only · no login · programmable AI team OS
        </div>
      </div>

      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
