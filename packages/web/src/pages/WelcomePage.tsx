import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RuntimeDetection } from '@slark/shared';
import { getRuntimes } from '../lib/api';
import { useChannelsStore } from '../stores/channels';
import { useAgentsStore } from '../stores/agents';

export function WelcomePage() {
  const channels = useChannelsStore((s) => s.channels);
  const agents = useAgentsStore((s) => s.agents);
  const [runtimes, setRuntimes] = useState<RuntimeDetection[]>([]);

  useEffect(() => {
    void getRuntimes().then(setRuntimes).catch(() => {});
  }, []);

  const cursor = runtimes.find((r) => r.id === 'cursor');
  const cursorReady = cursor?.installed;

  return (
    <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-xl w-full bg-bg-card border-2 border-black rounded-xl p-8 shadow-[6px_6px_0_0_#000]">
        <h1 className="text-3xl font-bold mb-2">Welcome to Slark</h1>
        <p className="text-text-secondary mb-6">
          Local AI Agent collaboration platform — your Slack for Cursor CLI.
        </p>

        {!cursorReady && (
          <div className="mb-6 p-4 bg-accent-yellow border-2 border-black rounded">
            <div className="font-bold mb-1">⚠ Cursor CLI not installed</div>
            <div className="text-sm">
              Install <code className="font-mono">cursor-agent</code> from Cursor IDE to create your
              first agent. MVP currently only supports Cursor CLI.
            </div>
          </div>
        )}

        <div className="space-y-4">
          {channels.length > 0 && (
            <Section title="Channels">
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
            </Section>
          )}

          {agents.length > 0 && (
            <Section title="Agents">
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
            </Section>
          )}

          {agents.length === 0 && cursorReady && (
            <div className="text-text-secondary">
              No agents yet. Create one from the sidebar (+ next to AGENTS).
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-text-muted font-mono">
          Slark MVP · local-only · no login · no MCP
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="section-header mb-2">{title}</h2>
      {children}
    </div>
  );
}
