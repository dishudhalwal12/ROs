import type { ChatChannel } from '@/types/models';

export function hasEveryoneMention(body: string) {
  return /(^|\s)@everyone\b/i.test(body);
}

export function shouldBroadcastChannelMessage(
  channel: Pick<ChatChannel, 'id' | 'type'>,
  body: string,
) {
  return channel.type !== 'direct' && (channel.id === 'general' || hasEveryoneMention(body));
}
