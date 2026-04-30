/**
 * Welcome 页（路径 `/`）
 *
 * 行为（CP8.1 调整）：
 *   - **无 Project**：显示 CTA "Create your first Project"
 *   - **有 Project**：自动 redirect 到第一个 Project 的 `/p/{firstProject.name}`
 *     （ProjectIndexPage 会进一步跳到第一个 channel）
 *   - cursor-agent 未装时显示黄色警告条
 *
 * Project 内的 channel/agent 列表移到 ProjectIndexPage。
 */

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { RuntimeDetection } from '@slark/shared';
import { getRuntimes } from '../lib/api';
import { useProjectsStore } from '../stores/projects';
import { CreateProjectDialog } from '../components/CreateProjectDialog';
import { projectIndexPath } from '../lib/routes';

export function WelcomePage() {
  const projects = useProjectsStore((s) => s.projects);
  const projectsLoaded = useProjectsStore((s) => s.loaded);
  const [runtimes, setRuntimes] = useState<RuntimeDetection[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    void getRuntimes().then(setRuntimes).catch(() => {});
  }, []);

  const cursor = runtimes.find((r) => r.id === 'cursor');
  const cursorReady = cursor?.installed;

  // 等 store 加载完成再判断（否则刷新会闪一下 CTA）
  if (!projectsLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary font-mono">
        Loading…
      </div>
    );
  }

  // 有 Project：redirect 到第一个
  const firstProject = projects[0];
  if (firstProject) {
    return <Navigate to={projectIndexPath(firstProject.name)} replace />;
  }

  // 无 Project：CTA
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

        <div className="mt-6 text-xs text-text-muted font-mono">
          Slark v1.0 · local-only · no login · programmable AI team OS
        </div>
      </div>

      <CreateProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
