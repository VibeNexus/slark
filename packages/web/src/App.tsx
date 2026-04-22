/**
 * Slark Web App 入口
 *
 * - 初始化 stores（channels + agents + runtimes）
 * - 启动 WebSocket 连接
 * - 配置路由
 */

import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useChannelsStore } from './stores/channels';
import { useAgentsStore } from './stores/agents';
import { initWSBridge } from './stores/ws-bridge';
import { wsClient } from './lib/ws';
import { Layout } from './components/Layout';
import { WelcomePage } from './pages/WelcomePage';
import { ChannelPage } from './pages/ChannelPage';
import { DMPage } from './pages/DMPage';
import { GlobalThreadsPage } from './pages/GlobalThreadsPage';
import { GlobalTasksPage } from './pages/GlobalTasksPage';
import { SavedPage } from './pages/SavedPage';

export function App() {
  const refreshChannels = useChannelsStore((s) => s.refresh);
  const refreshAgents = useAgentsStore((s) => s.refresh);

  useEffect(() => {
    initWSBridge();
    wsClient.connect();
    void refreshChannels();
    void refreshAgents();
  }, [refreshChannels, refreshAgents]);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/channel/:channelId" element={<ChannelPage />} />
          <Route path="/dm/:agentId" element={<DMPage />} />
          <Route path="/threads" element={<GlobalThreadsPage />} />
          <Route path="/tasks" element={<GlobalTasksPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/agent/:agentId" element={<AgentPlaceholder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function AgentPlaceholder() {
  return (
    <div className="flex-1 flex items-center justify-center text-text-secondary font-mono">
      Agent Profile page — coming in MVP-8
    </div>
  );
}
