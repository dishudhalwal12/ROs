import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquareShare, Plus, Send, UsersRound } from 'lucide-react';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatRelativeTime } from '@/lib/format';
import type { ChatMessage } from '@/types/models';

type ComposeChatMode = 'team' | 'direct' | null;

export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    channels,
    members,
    unreadByChannel,
    presence,
    typingByChannel,
    realtimeEnabled,
    createDirectChannel,
    createTeamChannel,
    subscribeToMessages,
    sendMessage,
    markChannelRead,
    setTypingState,
  } = useWorkspace();
  const { member } = useAuth();
  const [composeMode, setComposeMode] = useState<ComposeChatMode>(null);
  const [channelName, setChannelName] = useState('');
  const [targetMemberId, setTargetMemberId] = useState('');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const selectedChannelId = searchParams.get('channel') ?? channels[0]?.id ?? null;
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const visibleChannels = useMemo(
    () =>
      channels.filter((channel) =>
        channel.type === 'team' || channel.type === 'project'
          ? true
          : channel.participantIds.includes(member?.uid ?? ''),
      ),
    [channels, member?.uid],
  );

  useEffect(() => {
    if (!selectedChannelId) {
      setMessages([]);
      return;
    }

    const unsubscribe = subscribeToMessages(selectedChannelId, (nextMessages) => {
      setMessages(nextMessages);
      void markChannelRead(selectedChannelId);
    });

    return unsubscribe;
  }, [markChannelRead, selectedChannelId, subscribeToMessages]);

  async function handleSend() {
    if (!selectedChannelId || !draft.trim()) return;
    await sendMessage(selectedChannelId, draft);
    setDraft('');
    await setTypingState(selectedChannelId, false);
  }

  async function handleCreateChannel() {
    if (composeMode === 'team') {
      const channelId = await createTeamChannel(channelName);
      setComposeMode(null);
      setChannelName('');
      setSearchParams(new URLSearchParams({ channel: channelId }));
      return;
    }

    if (composeMode === 'direct' && targetMemberId) {
      const channelId = await createDirectChannel(targetMemberId);
      setComposeMode(null);
      setTargetMemberId('');
      setSearchParams(new URLSearchParams({ channel: channelId }));
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header page-header--split">
        <div>
          <span className="eyebrow">Messages</span>
          <h1>Live channels, direct messages, and project conversation</h1>
          <p>Keep operational chat linked to the work instead of scattered across tools.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="pill-button" onClick={() => setComposeMode('team')}>
            <Plus size={16} />
            Team channel
          </button>
          <button type="button" className="secondary-button" onClick={() => setComposeMode('direct')}>
            <UsersRound size={16} />
            Direct chat
          </button>
        </div>
      </section>

      {!realtimeEnabled ? (
        <SectionCard title="Realtime setup required" subtitle="Messaging needs Realtime Database">
          <EmptyState
            icon={MessageSquareShare}
            title="Add `VITE_FIREBASE_DATABASE_URL`"
            description="The app is ready for live channels, unread counters, typing, and presence once the RTDB URL is configured."
          />
        </SectionCard>
      ) : (
        <div className="messaging-layout">
          <SectionCard title="Channels" subtitle="Team, project, and direct spaces">
            <div className="list-stack">
              {visibleChannels.map((channel) => {
                const counterpart =
                  channel.type === 'direct'
                    ? members.find(
                        (teamMember) =>
                          teamMember.uid !== member?.uid &&
                          channel.participantIds.includes(teamMember.uid),
                      )
                    : null;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    className={
                      channel.id === selectedChannelId
                        ? 'channel-row channel-row--active'
                        : 'channel-row'
                    }
                    onClick={() => setSearchParams(new URLSearchParams({ channel: channel.id }))}
                  >
                    <div>
                      <strong>{counterpart?.name ?? channel.name}</strong>
                      <p>{channel.lastMessage?.body ?? 'No messages yet'}</p>
                    </div>
                    <div className="list-row__meta">
                      {unreadByChannel[channel.id] ? (
                        <Badge tone="danger">{unreadByChannel[channel.id]}</Badge>
                      ) : null}
                      <small>
                        {channel.lastMessage
                          ? formatRelativeTime(channel.lastMessage.createdAt)
                          : channel.type}
                      </small>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title={selectedChannel ? selectedChannel.name : 'Conversation'}
            subtitle={
              selectedChannel?.type === 'direct'
                ? 'Private channel'
                : `${selectedChannel?.type ?? 'team'} channel`
            }
          >
            {selectedChannel ? (
              <>
                <div className="chat-members">
                  {selectedChannel.participantIds.map((participantId) => {
                    const participant = members.find((entry) => entry.uid === participantId);
                    if (!participant) return null;
                    const presenceState = presence[participant.uid]?.state ?? 'offline';
                    return (
                      <div key={participant.id} className="chat-members__item">
                        <Avatar member={participant} size="sm" />
                        <span>{participant.name}</span>
                        <Badge tone={presenceState === 'online' ? 'success' : 'neutral'}>
                          {presenceState}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
                <div className="chat-stream">
                  {messages.map((message) => {
                    const sender = members.find((entry) => entry.uid === message.senderId);
                    const mine = message.senderId === member?.uid;
                    return (
                      <article
                        key={message.id}
                        className={mine ? 'chat-message chat-message--mine' : 'chat-message'}
                      >
                        <div className="chat-message__meta">
                          <strong>{sender?.name ?? 'Team member'}</strong>
                          <small>{formatRelativeTime(message.createdAt)}</small>
                        </div>
                        <p>{message.body}</p>
                      </article>
                    );
                  })}
                </div>
                {typingByChannel[selectedChannel.id]?.length ? (
                  <small className="typing-indicator">
                    {typingByChannel[selectedChannel.id]
                      .map((uid) => members.find((entry) => entry.uid === uid)?.name ?? 'Someone')
                      .join(', ')}{' '}
                    typing...
                  </small>
                ) : null}
                <div className="chat-compose">
                  <textarea
                    rows={3}
                    value={draft}
                    onChange={(event) => {
                      setDraft(event.target.value);
                      void setTypingState(selectedChannel.id, event.target.value.length > 0);
                    }}
                    placeholder="Share an update, mention a teammate, or use @everyone to ping the whole channel."
                  />
                  <button type="button" className="primary-button" onClick={() => void handleSend()}>
                    <Send size={16} />
                    Send
                  </button>
                </div>
              </>
            ) : (
              <EmptyState
                icon={MessageSquareShare}
                title="Choose a channel"
                description="Select a team, project, or direct channel to start chatting."
              />
            )}
          </SectionCard>
        </div>
      )}

      <Modal
        title={composeMode === 'team' ? 'Create team channel' : 'Start direct chat'}
        open={Boolean(composeMode)}
        onClose={() => setComposeMode(null)}
      >
        {composeMode === 'team' ? (
          <div className="form-grid">
            <label>
              <span>Channel name</span>
              <input value={channelName} onChange={(event) => setChannelName(event.target.value)} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setComposeMode(null)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={() => void handleCreateChannel()}>
                <Plus size={16} />
                Create channel
              </button>
            </div>
          </div>
        ) : (
          <div className="form-grid">
            <label>
              <span>Team member</span>
              <select value={targetMemberId} onChange={(event) => setTargetMemberId(event.target.value)}>
                <option value="">Choose one</option>
                {members
                  .filter((teamMember) => teamMember.uid !== member?.uid)
                  .map((teamMember) => (
                    <option key={teamMember.id} value={teamMember.uid}>
                      {teamMember.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setComposeMode(null)}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={() => void handleCreateChannel()}>
                <UsersRound size={16} />
                Open direct chat
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
