/**
 * DM 顶部栏
 * 参考: docs/ui-reference/screenshots/20-dm-architect-desktop.png
 */

import { useSearchParams } from 'react-router-dom';
import type { Agent } from '@slark/shared';
import { Avatar } from './Avatar';
import { StatusDot, statusLabel } from './StatusDot';

interface Props {
  agent: Agent;
}

export function DMHeader({ agent }: Props) {
  const [params, setParams] = useSearchParams();
  const openProfile = () => {
    const next = new URLSearchParams(params);
    next.set('profile', `agent:${agent.id}`);
    next.set('agentTab', 'profile');
    setParams(next);
  };

  return (
    <div className="border-b-2 border-black bg-bg-card px-4 py-3 flex items-center gap-3">
      <button onClick={openProfile} className="flex items-center gap-3 flex-1 text-left min-w-0 hover:bg-bg-main -mx-2 px-2 py-1 rounded">
        <Avatar name={agent.name} kind="agent" size="md" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-bold">{agent.name}</span>
          <StatusDot status={agent.status} size="xs" />
          <span className="text-sm font-mono text-text-secondary">{statusLabel(agent.status)}</span>
        </div>
      </button>
    </div>
  );
}
