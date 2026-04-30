import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ChatMessage } from '@slark/shared';
import { useChannelsStore } from '../stores/channels';
import { useAgentsStore } from '../stores/agents';
import { useProjectsStore } from '../stores/projects';
import { useMessagesStore } from '../stores/messages';
import { wsClient } from '../lib/ws';
import { stopAllAgents } from '../lib/api';
import { projectChannelPath, projectIndexPath } from '../lib/routes';
import { useChannelCommands } from '../lib/useChannelCommands';
import { ChannelHeader } from '../components/ChannelHeader';
import { MessageList } from '../components/MessageList';
import { MessageInput } from '../components/MessageInput';
import { ThreadPanel } from '../components/ThreadPanel';
import { AgentProfilePanel } from '../components/AgentProfilePanel';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TasksPanel } from '../components/TasksPanel';
import { ChannelSettingsDialog } from '../components/ChannelSettingsDialog';

const EMPTY_MESSAGES: ChatMessage[] = [];

export function ChannelPage() {
  const { projectName, channelId } = useParams<{ projectName: string; channelId: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const threadId = params.get('thread');
  const chatTab = (params.get('chatTab') ?? 'chat') as 'chat' | 'tasks';
  const profileParam = params.get('profile'); // 形如 "agent:{id}"
  const profileAgentId = profileParam?.startsWith('agent:') ? profileParam.slice(6) : null;
  const channels = useChannelsStore((s) => s.channels);
  const channelsLoaded = useChannelsStore((s) => s.loaded);
  const allAgents = useAgentsStore((s) => s.agents);
  const profileAgent = profileAgentId ? allAgents.find((a) => a.id === profileAgentId) : null;
  const projects = useProjectsStore((s) => s.projects);
  // 关键：selector 返回稳定引用（不在 selector 里创建新数组），避免 re-render 循环
  const byChannel = useMessagesStore((s) => s.byChannel);
  const messages = channelId ? byChannel.get(channelId) ?? EMPTY_MESSAGES : EMPTY_MESSAGES;
  const streamBuffers = useMessagesStore((s) => s.streamBuffers);
  const fetchChannel = useMessagesStore((s) => s.fetchChannel);

  const channel = channels.find((c) => c.id === channelId);
  const upsertChannel = useChannelsStore((s) => s.upsert);
  const removeChannel = useChannelsStore((s) => s.remove);
  const [stopAllOpen, setStopAllOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState<{ open: boolean; tab: 'settings' | 'members' }>({
    open: false,
    tab: 'settings',
  });

  useEffect(() => {
    if (!channelId) return;
    void fetchChannel(channelId);
    wsClient.send({ type: 'subscribe_channel', channel_id: channelId });
    return () => {
      wsClient.send({ type: 'unsubscribe_channel', channel_id: channelId });
    };
  }, [channelId, fetchChannel]);

  const agentsById = useMemo(
    () => new Map(allAgents.map((a) => [a.id, a])),
    [allAgents],
  );

  // hook：必须在所有 early return 之前调用
  const channelCommands = useChannelCommands(channelId ?? null, false);

  if (!channelId || !projectName) return null;

  // 等 channels 加载完再判断 not-found，避免刷新时闪一下错误页
  if (!channelsLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary font-mono">
        Loading…
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary font-mono">
        Channel not found.
      </div>
    );
  }

  // 校验 channel 是否属于 URL 中的 project（CP8.1 跨 Project URL 安全）
  // v0 兼容数据可能 channel.project_id 为 null，此时不强制校验
  if (channel.project_id) {
    const project = projects.find((p) => p.name === projectName);
    if (!project || channel.project_id !== project.id) {
      // channel 不属于该 project：跳到该 channel 自己的 project
      const realProject = projects.find((p) => p.id === channel.project_id);
      if (realProject) {
        return <Navigate to={projectChannelPath(realProject.name, channel.id)} replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  const channelAgents = allAgents.filter(() => true); // 简化：显示全部 agent 数量（TODO: 真正按 channel）

  const send = (content: string, opts?: { asTask?: boolean }) => {
    wsClient.send({
      type: 'send_message',
      channel_id: channelId,
      content,
      as_task: opts?.asTask,
    });
  };

  const handleStopAll = () => setStopAllOpen(true);

  const confirmStopAll = async () => {
    if (!channelId) return;
    await stopAllAgents(channelId);
  };

  const openThread = (messageId: string) => {
    const next = new URLSearchParams(params);
    next.set('thread', messageId);
    setParams(next);
  };

  return (
    <div className="flex-1 flex min-w-0 min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <ChannelHeader
          channel={channel}
          memberCount={channelAgents.length + 1}
          onStopAll={handleStopAll}
          onEditChannel={() => setSettingsOpen({ open: true, tab: 'settings' })}
          onManageMembers={() => setSettingsOpen({ open: true, tab: 'members' })}
        />
        {chatTab === 'tasks' ? (
          <TasksPanel channelId={channelId} agents={allAgents} />
        ) : (
          <>
            <MessageList
              messages={messages}
              agentsById={agentsById}
              streamBuffers={streamBuffers}
              onOpenThread={openThread}
              emptyHint={`No messages yet. Try "@${channelAgents[0]?.name ?? 'Agent'} hello".`}
            />
            <MessageInput
              placeholder={`Message #${channel.name}`}
              onSend={send}
              commands={channelCommands}
            />
          </>
        )}
      </div>
      {/* 右侧第 3 栏：Thread 和 Profile 互斥 */}
      {threadId && channelId && <ThreadPanel channelId={channelId} />}
      {!threadId && profileAgent && <AgentProfilePanel agent={profileAgent} />}

      <ConfirmDialog
        open={stopAllOpen}
        title="STOP ALL AGENTS"
        description={`This will immediately stop all running agents in #${channel.name}. You can provide new guidance before resuming them.`}
        confirmLabel="Stop All Agents"
        danger
        onClose={() => setStopAllOpen(false)}
        onConfirm={confirmStopAll}
      />
      <ChannelSettingsDialog
        open={settingsOpen.open}
        channel={channel}
        initialTab={settingsOpen.tab}
        onClose={() => setSettingsOpen({ open: false, tab: 'settings' })}
        onUpdated={(c) => upsertChannel(c)}
        onDeleted={(id) => {
          removeChannel(id);
          // 删除后回到 Project index（自动跳到下一个 channel）
          navigate(projectIndexPath(projectName));
        }}
      />
    </div>
  );
}
