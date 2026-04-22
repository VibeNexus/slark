/**
 * WS → stores 的中继：订阅 wsClient 事件，分发到对应 store
 */

import type { ServerEvent } from '@slark/shared';
import { wsClient } from '../lib/ws';
import { useAgentsStore } from './agents';
import { useMessagesStore } from './messages';

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
      case 'agent_status':
        useAgentsStore.getState().setStatus(event.agent_id, event.status);
        break;
      default:
        break;
    }
  });
}
