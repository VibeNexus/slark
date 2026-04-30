/**
 * WS → stores 的中继：订阅 wsClient 事件，分发到对应 store
 */

import type { ServerEvent } from '@slark/shared';
import { wsClient } from '../lib/ws';
import { useAgentsStore } from './agents';
import { useMessagesStore } from './messages';
import { useWorkflowsStore } from './workflows';

let initialized = false;

export function initWSBridge(): void {
  if (initialized) return;
  initialized = true;

  wsClient.subscribe((event: ServerEvent) => {
    switch (event.type) {
      case 'message':
        useMessagesStore.getState().upsertMessage(event.message);
        break;
      case 'message_stream':
        useMessagesStore.getState().appendDelta(event.message_id, event.delta);
        break;
      case 'message_done':
        useMessagesStore
          .getState()
          .finalizeMessage(event.message_id, event.final_content, event.metadata);
        break;
      case 'workflow_run_update': {
        // CP4：runner 推进或终止时同步进度条
        useWorkflowsStore.getState().upsertRun(event.run);
        break;
      }
      case 'agent_status': {
        // CP8.3：状态完全由 agent_runs 派生（per-channel）。
        // - thinking/working/error/stopped：写入 per-channel map
        // - idle：表示该 channel 的 run 结束，从 map 移除
        // 旧的 agents.status 字段已删除，前端不再维护"全局 status"，而是通过 getDerivedStatus 派生。
        const store = useAgentsStore.getState();
        if (event.channel_id) {
          if (event.status === 'idle') {
            store.clearChannelRun(event.agent_id, event.channel_id);
          } else {
            store.setChannelRunStatus(event.agent_id, event.channel_id, event.status);
          }
        }
        break;
      }
      default:
        break;
    }
  });
}
