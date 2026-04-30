/**
 * Workflows 管理页（Sprint 3 CP4）
 *
 * 路由：/p/:projectName/workflows
 *
 * 功能：
 *   - 列出该 Project 内所有 workflows（builtin / user 区分）
 *   - 导出：下载 YAML 文件（GET /api/workflows/:id/export）
 *   - 导入：上传 .yaml 文件（POST /api/projects/:id/workflows/import）
 *   - 删除（仅 source='user'，避免误删 builtin；用户想编辑 builtin 的话仍可走 PATCH）
 *
 * 注：Workflow 的 YAML 编辑器（行内文本编辑）属于 Sprint 4+ 范畴。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { Workflow } from '@slark/shared';
import {
  deleteWorkflow,
  exportWorkflowYaml,
  importWorkflowYaml,
  listProjectWorkflows,
} from '../lib/api';
import { useProjectsStore } from '../stores/projects';
import { useWorkflowsStore } from '../stores/workflows';
import { cn } from '../lib/cn';

export function WorkflowsPage() {
  const { projectName } = useParams<{ projectName: string }>();
  const projects = useProjectsStore((s) => s.projects);
  const project = useMemo(
    () => projects.find((p) => p.name === projectName) ?? null,
    [projects, projectName],
  );
  const upsertWorkflow = useWorkflowsStore((s) => s.upsertWorkflow);
  const fetchProjectWorkflows = useWorkflowsStore((s) => s.fetchProjectWorkflows);

  const [items, setItems] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [overwriteOnImport, setOverwriteOnImport] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!project) return;
    setLoading(true);
    try {
      const list = await listProjectWorkflows(project.id);
      setItems(list);
      for (const wf of list) upsertWorkflow(wf);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // 该 effect 仅依赖 project.id；project 变化时重新加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  if (!project) return <Navigate to="/" replace />;

  const onExport = async (wf: Workflow) => {
    setBusyId(wf.id);
    try {
      const { filename, yaml } = await exportWorkflowYaml(wf.id);
      triggerDownload(filename, yaml);
    } catch (e) {
      alert(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (wf: Workflow) => {
    if (wf.source === 'builtin') {
      if (
        !confirm(
          `"${wf.name}" is a builtin template. Deleting it removes it from this project; it will be re-seeded on the next server start. Continue?`,
        )
      ) {
        return;
      }
    } else if (!confirm(`Delete workflow "${wf.name}"? This cannot be undone.`)) {
      return;
    }
    setBusyId(wf.id);
    try {
      await deleteWorkflow(wf.id);
      await load();
      void fetchProjectWorkflows(project.id);
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const onImportClick = () => fileInputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset to allow re-uploading the same file
    if (!file) return;
    setImportStatus('Reading…');
    try {
      const text = await file.text();
      const res = await importWorkflowYaml(project.id, {
        definition_yaml: text,
        overwrite: overwriteOnImport,
      });
      setImportStatus(
        `${res.mode === 'created' ? 'Created' : 'Updated'}: ${res.imported.name} (${res.imported.trigger_command})`,
      );
      await load();
      void fetchProjectWorkflows(project.id);
    } catch (e) {
      setImportStatus(`Failed: ${(e as Error).message}`);
    }
  };

  const builtin = items.filter((w) => w.source === 'builtin');
  const userWfs = items.filter((w) => w.source === 'user');

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <header className="border-b-2 border-black bg-bg-card px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-accent-yellow border-2 border-black rounded flex items-center justify-center">
          <span className="text-lg">⚙</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold">Workflows</div>
          <div className="text-xs font-mono text-text-secondary truncate">
            {project.display_name ?? project.name} · {items.length} total
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-mono text-text-secondary flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={overwriteOnImport}
              onChange={(e) => setOverwriteOnImport(e.target.checked)}
              className="w-3.5 h-3.5 border-2 border-black accent-accent-pink"
            />
            overwrite on import
          </label>
          <button
            onClick={onImportClick}
            className="px-3 py-1.5 text-xs font-bold border-2 border-black rounded bg-accent-pink hover:brightness-105"
          >
            Import YAML…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml,application/x-yaml,text/yaml"
            className="hidden"
            onChange={(e) => void onFileChange(e)}
          />
        </div>
      </header>

      {importStatus && (
        <div className="px-4 py-1.5 text-[12px] font-mono bg-accent-yellow border-b-2 border-black">
          {importStatus}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-text-secondary font-mono text-sm">Loading…</div>
        ) : (
          <>
            <Section title="BUILTIN" items={builtin} onExport={onExport} onDelete={onDelete} busyId={busyId} />
            <Section title="USER" items={userWfs} onExport={onExport} onDelete={onDelete} busyId={busyId} />
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  onExport,
  onDelete,
  busyId,
}: {
  title: string;
  items: Workflow[];
  onExport: (wf: Workflow) => void;
  onDelete: (wf: Workflow) => void;
  busyId: string | null;
}) {
  return (
    <div>
      <div className="section-header mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-text-muted font-mono text-xs p-3 border-2 border-dashed border-black/30 rounded">
          No {title.toLowerCase()} workflows yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((wf) => (
            <Row key={wf.id} wf={wf} onExport={onExport} onDelete={onDelete} busy={busyId === wf.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({
  wf,
  onExport,
  onDelete,
  busy,
}: {
  wf: Workflow;
  onExport: (wf: Workflow) => void;
  onDelete: (wf: Workflow) => void;
  busy: boolean;
}) {
  const stepCount = countSteps(wf.definition_yaml);
  return (
    <div className="flex items-start gap-3 p-3 border-2 border-black rounded bg-bg-card">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-sm truncate">{wf.name}</span>
          <code className="text-[11px] font-mono bg-accent-yellow px-1 rounded">
            {wf.trigger_command}
          </code>
          <SourceBadge source={wf.source} />
        </div>
        {wf.description && (
          <div className="text-[12px] text-text-secondary truncate">{wf.description}</div>
        )}
        <div className="text-[10px] font-mono text-text-muted mt-0.5">
          {stepCount > 0 ? `${stepCount} step(s)` : 'no steps parsed'} · updated{' '}
          {formatTime(wf.updated_at)}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => void onExport(wf)}
          disabled={busy}
          className="px-2 py-1 text-[11px] font-bold border-2 border-black rounded bg-bg-card hover:bg-accent-yellow disabled:opacity-50"
          title="Download YAML"
        >
          Export
        </button>
        <button
          onClick={() => void onDelete(wf)}
          disabled={busy}
          className="px-2 py-1 text-[11px] font-bold border-2 border-black rounded bg-bg-card hover:bg-accent-red disabled:opacity-50"
          title="Delete"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: Workflow['source'] }) {
  const cls = source === 'builtin' ? 'bg-accent-cyan' : 'bg-[#b8e98c]';
  return (
    <span
      className={cn(
        'px-1.5 py-0.5 text-[9px] font-mono font-bold border-2 border-black rounded',
        cls,
      )}
    >
      {source.toUpperCase()}
    </span>
  );
}

function countSteps(yamlText: string): number {
  // 简易估算：计 "  - id:" 的行数
  const m = yamlText.match(/^\s*-\s+id:\s*[^\s]+/gm);
  return m?.length ?? 0;
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function triggerDownload(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/x-yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
