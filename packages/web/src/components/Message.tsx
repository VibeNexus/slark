/**
 * Message 组件 — 按 sender_type 分三种样式
 *
 * 参考: docs/ui-reference/screenshots/10-channel-main-desktop.png
 */

import { useEffect, useState } from 'react';
import type { Agent, ChatMessage } from '@slark/shared';
import { cn } from '../lib/cn';
import { isMessageSaved, saveMessage, unsaveMessage } from '../lib/api';
import { Avatar } from './Avatar';
import { MessageContent } from './MessageContent';

export interface MessageProps {
  message: ChatMessage;
  agent?: Agent;
  /** 流式中的增量文本（如果有），优先于 message.content 展示 */
  streamingText?: string;
  /** 是否有 thread reply 已存在；用于显示 "N replies" 按钮 */
  onOpenThread?: (rootId: string) => void;
}

export function Message({ message, agent, streamingText, onOpenThread }: MessageProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (message.sender_type === 'system') return;
    let cancelled = false;
    isMessageSaved(message.id)
      .then((r) => {
        if (!cancelled) setSaved(r.saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [message.id, message.sender_type]);

  const toggleSave = async () => {
    if (saved) {
      await unsaveMessage(message.id);
      setSaved(false);
    } else {
      await saveMessage(message.id);
      setSaved(true);
    }
  };

  if (message.sender_type === 'system') {
    return <SystemMessage message={message} />;
  }

  const isStreaming = !!message.metadata?.streaming;
  const displayText = isStreaming
    ? streamingText ?? message.content
    : message.content || streamingText || '';

  const displayName =
    message.sender_type === 'agent' ? agent?.name ?? 'Agent' : 'You';

  const descSnippet =
    message.sender_type === 'agent'
      ? agent?.description?.split(/[\n。.]/)[0]?.slice(0, 60) ?? ''
      : '';

  return (
    <div className="flex gap-3 py-1.5 group">
      <Avatar
        name={displayName}
        kind={message.sender_type === 'agent' ? 'agent' : 'user'}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-bold">{displayName}</span>
          {message.sender_type === 'user' && (
            <span className="text-[11px] font-mono text-text-secondary">owner</span>
          )}
          {descSnippet && (
            <span className="text-[11px] font-mono text-text-secondary truncate max-w-[260px]">
              {descSnippet}
            </span>
          )}
          <span className="text-[11px] font-mono text-text-secondary ml-auto">
            {formatTime(message.created_at)}
          </span>
          <button
            onClick={() => void toggleSave()}
            className={cn(
              'opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center border-2 border-black rounded',
              saved ? 'bg-accent-yellow opacity-100' : 'bg-bg-card hover:bg-accent-yellow',
            )}
            title={saved ? 'Remove from saved' : 'Save message'}
            aria-label={saved ? 'Remove from saved' : 'Save message'}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        <MessageContent content={displayText} isStreaming={isStreaming} />

        {message.reply_count > 0 && onOpenThread && (
          <button
            onClick={() => onOpenThread(message.id)}
            className="mt-1 inline-flex items-center gap-1.5 px-2 py-1 bg-accent-cyan border-2 border-black rounded text-xs font-medium hover:bg-accent-teal"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
    </div>
  );
}

function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 py-0.5 text-xs text-text-secondary">
      <span className="font-mono pt-0.5 tabular-nums">{formatTime(message.created_at)}</span>
      <span
        className={cn(
          'flex-1 whitespace-pre-wrap font-mono leading-relaxed',
          message.content.startsWith('⚠') && 'text-accent-red',
        )}
      >
        {message.content}
      </span>
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
