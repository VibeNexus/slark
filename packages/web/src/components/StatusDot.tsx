import type { AgentStatus } from '@slark/shared';
import { cn } from '../lib/cn';

const COLOR_VAR: Record<AgentStatus, string> = {
  idle: 'var(--color-status-online)',
  thinking: 'var(--color-status-thinking)',
  working: 'var(--color-status-working)',
  error: 'var(--color-status-error)',
  stopped: 'var(--color-status-offline)',
};

const TEXT_LABEL: Record<AgentStatus, string> = {
  idle: 'Online',
  thinking: 'Thinking',
  working: 'Working',
  error: 'Error',
  stopped: 'Offline',
};

interface Props {
  status: AgentStatus;
  size?: 'xs' | 'sm';
  className?: string;
  animated?: boolean;
}

export function StatusDot({ status, size = 'sm', className, animated = true }: Props) {
  const dim = size === 'xs' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  const isActive = status === 'thinking' || status === 'working';
  return (
    <span
      className={cn('inline-block rounded-full', dim, animated && isActive && 'animate-pulse', className)}
      style={{ background: COLOR_VAR[status] }}
      title={TEXT_LABEL[status]}
    />
  );
}

export function statusLabel(status: AgentStatus): string {
  return TEXT_LABEL[status];
}
