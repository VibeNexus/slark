/**
 * Project Index Page — `/p/:projectName`
 *
 * 行为：
 *   - 该 Project 至少有一个 channel：自动 redirect 到第一个 channel
 *   - 没有 channel：显示空状态卡片，引导创建 channel 或 agent
 *
 * 由 ProjectScope（App.tsx）作为 outlet 渲染。
 */

import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useChannelsStore } from '../stores/channels';
import { useAgentsStore } from '../stores/agents';
import { useProjectsStore } from '../stores/projects';
import { projectChannelPath, projectDmPath } from '../lib/routes';

export function ProjectIndexPage() {
  const { projectName } = useParams<{ projectName: string }>();
  const projects = useProjectsStore((s) => s.projects);
  const channels = useChannelsStore((s) => s.channels);
  const agents = useAgentsStore((s) => s.agents);

  const project = useMemo(
    () => projects.find((p) => p.name === projectName) ?? null,
    [projects, projectName],
  );

  const projectChannels = useMemo(() => {
    if (!project) return [];
    return channels.filter((c) => c.project_id === project.id || !c.project_id);
  }, [channels, project]);

  const projectAgents = useMemo(() => {
    if (!project) return [];
    return agents.filter((a) => a.project_id === project.id || !a.project_id);
  }, [agents, project]);

  if (!project || !projectName) return <Navigate to="/" replace />;

  // 有 channel → 自动跳到第一个
  const firstChannel = projectChannels[0];
  if (firstChannel) {
    return <Navigate to={projectChannelPath(projectName, firstChannel.id)} replace />;
  }

  // 无 channel：空状态
  return (
    <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-xl w-full bg-bg-card border-2 border-black rounded-xl p-8 shadow-[6px_6px_0_0_#000]">
        <h1 className="text-2xl font-bold mb-2">{project.display_name ?? project.name}</h1>
        <div className="text-[12px] font-mono text-text-secondary mb-6">{project.workspace_path}</div>
        <div className="text-sm mb-6">{project.goal}</div>

        <div className="p-4 bg-accent-yellow border-2 border-black rounded mb-4">
          <div className="font-bold mb-1">No channels yet</div>
          <div className="text-sm">
            Create a channel or DM an agent from the sidebar to start collaborating.
          </div>
        </div>

        {projectAgents.length > 0 && (
          <div>
            <div className="section-header mb-2">AGENTS IN THIS PROJECT</div>
            <ul className="space-y-1">
              {projectAgents.map((a) => (
                <li key={a.id}>
                  <Link
                    to={projectDmPath(projectName, a.id)}
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
    </div>
  );
}
