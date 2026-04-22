import { useEffect, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { useChannelsStore } from '../stores/channels';
import { useAgentsStore } from '../stores/agents';
import { Sidebar } from './Sidebar';
import { CreateAgentDialog } from './CreateAgentDialog';
import { CreateChannelDialog } from './CreateChannelDialog';
import { SearchDialog } from './SearchDialog';

interface Props {
  children: React.ReactNode;
}

export function Layout({ children }: Props) {
  const channels = useChannelsStore((s) => s.channels);
  const agents = useAgentsStore((s) => s.agents);
  const upsertChannel = useChannelsStore((s) => s.upsert);
  const [createAgentOpen, setCreateAgentOpen] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // 全局快捷键：⌘/Ctrl+K 打开搜索
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 从 URL 取当前激活项
  const channelMatch = useMatch('/channel/:channelId');
  const dmMatch = useMatch('/dm/:agentId');

  const autoJoinChannelId = channelMatch?.params.channelId;

  return (
    <div className="h-full flex">
      <Sidebar
        channels={channels}
        agents={agents}
        currentChannelId={channelMatch?.params.channelId}
        currentDmAgentId={dmMatch?.params.agentId}
        onCreateAgent={() => setCreateAgentOpen(true)}
        onCreateChannel={() => setCreateChannelOpen(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-bg-main">
        {children}
      </div>
      <CreateAgentDialog
        open={createAgentOpen}
        onClose={() => setCreateAgentOpen(false)}
        autoJoinChannelId={autoJoinChannelId}
      />
      <CreateChannelDialog
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        onCreated={(c) => upsertChannel(c)}
      />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
