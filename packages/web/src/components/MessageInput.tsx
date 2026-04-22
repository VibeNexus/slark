/**
 * 消息输入框
 *
 * 参考: docs/ui-reference/screenshots/10-channel-main-desktop.png 底部
 */

import { useRef, useState } from 'react';
import { cn } from '../lib/cn';

interface Props {
  placeholder?: string;
  showAsTask?: boolean;
  onSend: (content: string, opts?: { asTask?: boolean }) => void;
  disabled?: boolean;
}

export function MessageInput({
  placeholder = 'Message',
  showAsTask = true,
  onSend,
  disabled,
}: Props) {
  const [value, setValue] = useState('');
  const [asTask, setAsTask] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text, { asTask });
    setValue('');
    setAsTask(false);
    setTimeout(() => ref.current?.focus(), 0);
  };

  return (
    <div className="border-t-2 border-black bg-bg-card p-3">
      <div className="border-2 border-black rounded-lg bg-bg-card overflow-hidden">
        <textarea
          ref={ref}
          rows={2}
          className="w-full px-3 py-2 resize-none focus:outline-none bg-bg-card text-sm"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={disabled}
        />
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-black/20">
          <div className="flex items-center gap-1">
            <IconButton title="Attach image (coming soon)" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </IconButton>
            <IconButton title="Attach file (coming soon)" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </IconButton>
          </div>
          <div className="flex items-center gap-3">
            {showAsTask && (
              <label
                className="flex items-center gap-1.5 text-xs font-mono text-text-secondary cursor-pointer"
                title="Also create a task for this message"
              >
                <input
                  type="checkbox"
                  checked={asTask}
                  onChange={(e) => setAsTask(e.target.checked)}
                  className="w-3.5 h-3.5 border-2 border-black accent-accent-pink"
                />
                As Task
              </label>
            )}
            <button
              onClick={submit}
              disabled={!value.trim() || disabled}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded font-bold text-sm border-2 border-black',
                !value.trim() || disabled
                  ? 'bg-[#f5bfd2] opacity-60 cursor-not-allowed'
                  : 'bg-accent-pink hover:brightness-105',
              )}
            >
              Send
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'w-7 h-7 flex items-center justify-center border-2 border-black rounded',
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-accent-pink',
      )}
    >
      {children}
    </button>
  );
}
