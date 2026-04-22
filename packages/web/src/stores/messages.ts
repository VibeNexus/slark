/**
 * Messages store — 按 channel 组织消息缓存，带流式 delta 支持
 *
 * 结构:
 *   channels: Map<channelId, ChatMessage[]>  // 已持久化的消息
 *   streamBuffers: Map<messageId, string>    // 正在流式的 delta 累加（message.content 为空时使用）
 */

import { create } from 'zustand';
import type { ChatMessage, MessageMetadata } from '@slark/shared';
import { getChannelMessages } from '../lib/api';

interface MessagesState {
  byChannel: Map<string, ChatMessage[]>;
  streamBuffers: Map<string, string>;
  loadingChannels: Set<string>;

  fetchChannel: (channelId: string) => Promise<void>;
  upsertMessage: (msg: ChatMessage) => void;
  appendDelta: (messageId: string, delta: string) => void;
  finalizeMessage: (messageId: string, finalContent: string, metadata: MessageMetadata) => void;

  getChannelMessages: (channelId: string) => ChatMessage[];
  getStreamingText: (messageId: string) => string | undefined;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  byChannel: new Map(),
  streamBuffers: new Map(),
  loadingChannels: new Set(),

  fetchChannel: async (channelId) => {
    if (get().loadingChannels.has(channelId)) return;
    set((s) => {
      const next = new Set(s.loadingChannels);
      next.add(channelId);
      return { loadingChannels: next };
    });
    try {
      const messages = await getChannelMessages(channelId);
      set((s) => {
        const next = new Map(s.byChannel);
        next.set(channelId, messages);
        const loading = new Set(s.loadingChannels);
        loading.delete(channelId);
        return { byChannel: next, loadingChannels: loading };
      });
    } catch (e) {
      set((s) => {
        const loading = new Set(s.loadingChannels);
        loading.delete(channelId);
        return { loadingChannels: loading };
      });
      throw e;
    }
  },

  upsertMessage: (msg) =>
    set((s) => {
      const next = new Map(s.byChannel);
      const arr = next.get(msg.channel_id) ?? [];
      const idx = arr.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        const copy = [...arr];
        copy[idx] = msg;
        next.set(msg.channel_id, copy);
      } else {
        next.set(msg.channel_id, [...arr, msg]);
      }
      return { byChannel: next };
    }),

  appendDelta: (messageId, delta) =>
    set((s) => {
      const next = new Map(s.streamBuffers);
      next.set(messageId, (next.get(messageId) ?? '') + delta);
      return { streamBuffers: next };
    }),

  finalizeMessage: (messageId, finalContent, metadata) =>
    set((s) => {
      // 更新消息 content/metadata
      const nextBuffers = new Map(s.streamBuffers);
      nextBuffers.delete(messageId);

      const nextByChannel = new Map(s.byChannel);
      for (const [chId, msgs] of nextByChannel) {
        const idx = msgs.findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          const copy = [...msgs];
          copy[idx] = {
            ...copy[idx]!,
            content: finalContent,
            metadata,
          };
          nextByChannel.set(chId, copy);
          break;
        }
      }

      return { byChannel: nextByChannel, streamBuffers: nextBuffers };
    }),

  getChannelMessages: (channelId) => get().byChannel.get(channelId) ?? [],
  getStreamingText: (messageId) => get().streamBuffers.get(messageId),
}));
