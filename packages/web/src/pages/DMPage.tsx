import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { ChatMessage } from '@slark/shared';
import { useAgentsStore } from '../stores/agents';
import { useMessagesStore } from '../stores/messages';
import { useChannelsStore } from '../stores/channels';
import { wsClient } from '../lib/ws';
import { DMHeader } from '../components/DMHeader';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { AgentProfilePanel } from '../components/AgentProfilePanel';

const EMPTY_MESSAGES: ChatMessage[] = [];

/**
 * MVP 简化：
 *   DM 并非独立 channel type=dm，当前把 agent 接在 #general 里。
 *   真正的 DM 实现需要独立 channel_id，后续迭代补。
 *   这里 DMPage 展示同一个 #general 的消息 + 输入时直接 @此 agent。
 *
 * (slock.ai 原版的 DM 是一个 type=dm 的 channel，内部只有 user + 该 agent)
 */
export function DMPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [params] = useSearchParams();
  const profileParam = params.get('profile');
  const profileAgentId = profileParam?.startsWith('agent:') ? profileParam.slice(6) : null;
  const agents = useAgentsStore((s) => s.agents);
  const agent = agents.find((a) => a.id === agentId);
  const profileAgent = profileAgentId ? agents.find((a) => a.id === profileAgentId) : null;
  const channels = useChannelsStore((s) => s.channels);
  const generalChannel = channels.find((c) => c.name === 'general');
  const channelId = generalChannel?.id;

  const byChannel = useMessagesStore((s) => s.byChannel);
  const messages = channelId ? byChannel.get(channelId) ?? EMPTY_MESSAGES : EMPTY_MESSAGES;
  const streamBuffers = useMessagesStore((s) => s.streamBuffers);
  const fetchChannel = useMessagesStore((s) => s.fetchChannel);

  useEffect(() => {
    if (!channelId) return;
    void fetchChannel(channelId);
    wsClient.send({ type: 'subscribe_channel', channel_id: channelId });
    return () => {
      wsClient.send({ type: 'unsubscribe_channel', channel_id: channelId });
    };
  }, [channelId, fetchChannel]);

  const agentsById = useMemo(() => {
    const m = new Map();
    if (agent) m.set(agent.id, agent);
    return m;
  }, [agent]);

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary font-mono">
        Agent not found.
      </div>
    );
  }

  // 只展示和这个 agent 相关的消息（及用户发给它的）
  const filtered = messages.filter(
    (m) =>
      m.sender_type === 'system' ||
      m.sender_id === agent.id ||
      (m.sender_type === 'user' && m.content.includes(`@${agent.name}`)),
  );

  const send = (content: string, opts?: { asTask?: boolean }) => {
    if (!channelId) return;
    const c = content.includes(`@${agent.name}`) ? content : `@${agent.name} ${content}`;
    wsClient.send({
      type: 'send_message',
      channel_id: channelId,
      content: c,
      as_task: opts?.asTask,
    });
  };

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <DMHeader agent={agent} />
        <MessageList
          messages={filtered}
          agentsById={agentsById}
          streamBuffers={streamBuffers}
          emptyHint={`Start a conversation with ${agent.name}.`}
        />
        <MessageInput
          placeholder={`Message @${agent.name}`}
          onSend={send}
        />
      </div>
      {profileAgent && <AgentProfilePanel agent={profileAgent} />}
    </div>
  );
}
