import {
  hasEveryoneMention,
  shouldBroadcastChannelMessage,
} from '@/lib/chat-notifications';

describe('chat notification helpers', () => {
  it('detects @everyone mentions', () => {
    expect(hasEveryoneMention('Please review this @everyone')).toBe(true);
    expect(hasEveryoneMention('@EVERYONE quick update')).toBe(true);
    expect(hasEveryoneMention('hello everyone')).toBe(false);
  });

  it('broadcasts general messages to everyone', () => {
    expect(
      shouldBroadcastChannelMessage({ id: 'general', type: 'team' }, 'Daily update'),
    ).toBe(true);
  });

  it('broadcasts non-direct channels only when @everyone is used', () => {
    expect(
      shouldBroadcastChannelMessage(
        { id: 'project_123', type: 'project' },
        'Heads up @everyone',
      ),
    ).toBe(true);
    expect(
      shouldBroadcastChannelMessage(
        { id: 'team_123', type: 'team' },
        'Heads up team',
      ),
    ).toBe(false);
  });

  it('never broadcasts direct chats to everyone', () => {
    expect(
      shouldBroadcastChannelMessage(
        { id: 'dm_123', type: 'direct' },
        'Hello @everyone',
      ),
    ).toBe(false);
  });
});
