import { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, MessageSquareShare, Plus, Search, UsersRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { SectionCard } from '@/components/ui/SectionCard';
import { MessageComposer } from '@/features/messages/MessageComposer';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { formatRelativeTime } from '@/lib/format';
import type { ChatChannel, ChatMessage, Member } from '@/types/models';

type ComposeChatMode = 'team' | 'direct' | null;

function getDirectCounterpart(
  channel: ChatChannel,
  members: Member[],
  currentUid?: string,
) {
  if (channel.type !== 'direct') return null;

  return (
    members.find(
      (teamMember) =>
        teamMember.uid !== currentUid && channel.participantIds.includes(teamMember.uid),
    ) ?? null
  );
}

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
  const [draftByChannel, setDraftByChannel] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const messageStreamRef = useRef<HTMLDivElement | null>(null);
  const railListRef = useRef<HTMLDivElement | null>(null);
  const previousChannelIdRef = useRef<string | null>(null);

  const selectedChannelId = searchParams.get('channel') ?? channels[0]?.id ?? null;
  const visibleChannels = useMemo(
    () =>
      channels.filter((channel) =>
        channel.type === 'team' || channel.type === 'project'
          ? true
          : channel.participantIds.includes(member?.uid ?? ''),
      ),
    [channels, member?.uid],
  );
  const filteredChannels = useMemo(() => {
    if (!query.trim()) return visibleChannels;

    const normalizedQuery = query.trim().toLowerCase();
    return visibleChannels.filter((channel) => {
      const counterpart = getDirectCounterpart(channel, members, member?.uid);
      return [channel.name, counterpart?.name, channel.lastMessage?.body]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [member?.uid, members, query, visibleChannels]);
  const selectedChannel =
    visibleChannels.find((channel) => channel.id === selectedChannelId) ?? null;
  const draft = selectedChannelId ? draftByChannel[selectedChannelId] ?? '' : '';
  const selectedCounterpart = selectedChannel
    ? getDirectCounterpart(selectedChannel, members, member?.uid)
    : null;
  const selectedParticipants = selectedChannel
    ? selectedChannel.participantIds
        .map((participantId) => members.find((entry) => entry.uid === participantId))
        .filter((entry): entry is Member => Boolean(entry))
    : [];

  useEffect(() => {
    if (!selectedChannelId) return;

    const unsubscribe = subscribeToMessages(selectedChannelId, (nextMessages) => {
      setMessages(nextMessages);
      void markChannelRead(selectedChannelId);
    });

    return unsubscribe;
  }, [markChannelRead, selectedChannelId, subscribeToMessages]);

  useEffect(() => {
    if (railListRef.current) {
      railListRef.current.scrollTop = 0;
    }
  }, [filteredChannels, selectedChannelId]);

  useEffect(() => {
    const stream = messageStreamRef.current;
    if (!stream) return;
    stream.scrollTop = stream.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const previousChannelId = previousChannelIdRef.current;
    if (previousChannelId && previousChannelId !== selectedChannelId) {
      void setTypingState(previousChannelId, false);
    }

    previousChannelIdRef.current = selectedChannelId;

    return () => {
      if (selectedChannelId) {
        void setTypingState(selectedChannelId, false);
      }
    };
  }, [selectedChannelId, setTypingState]);

  async function handleSend() {
    if (!selectedChannelId || !draft.trim()) return;
    await sendMessage(selectedChannelId, draft);
    setDraftByChannel((current) => ({
      ...current,
      [selectedChannelId]: '',
    }));
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
          <h1>Team chat that feels fast, clean, and alive</h1>
          <p>Keep daily chatter polished and tied to the work instead of juggling another tool.</p>
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
        <div className="messages-page">
          <aside className="messages-rail">
            <div className="messages-rail__header">
              <div>
                <span className="eyebrow">Inbox</span>
                <h2>Conversations</h2>
              </div>
              <div className="messages-rail__actions">
                <button type="button" className="icon-button" onClick={() => setComposeMode('team')}>
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <label className="messages-search">
              <Search size={16} />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search channels or people"
              />
            </label>

            <div className="messages-rail__list" ref={railListRef}>
              {filteredChannels.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="Nothing matched"
                  description="Try another name, channel, or message snippet."
                />
              ) : (
                filteredChannels.map((channel) => {
                  const counterpart = getDirectCounterpart(channel, members, member?.uid);
                  const isOnline =
                    counterpart ? presence[counterpart.uid]?.state === 'online' : false;
                  const previewTitle = counterpart?.name ?? channel.name;
                  const previewSubtitle =
                    channel.lastMessage?.body ??
                    (channel.type === 'direct' ? 'Start the conversation' : 'No messages yet');

                  return (
                    <button
                      key={channel.id}
                      type="button"
                      className={
                        channel.id === selectedChannelId
                          ? 'messages-rail__item messages-rail__item--active'
                          : 'messages-rail__item'
                      }
                      onClick={() => setSearchParams(new URLSearchParams({ channel: channel.id }))}
                    >
                      <div className="messages-rail__avatar">
                        {counterpart ? (
                          <span
                            className={
                              isOnline
                                ? 'presence-ring presence-ring--online'
                                : 'presence-ring presence-ring--offline'
                            }
                          >
                            <Avatar member={counterpart} size="sm" shape="circle" />
                          </span>
                        ) : (
                          <span className="messages-rail__channel-icon">
                            <Hash size={15} />
                          </span>
                        )}
                      </div>
                      <div className="messages-rail__copy">
                        <div className="messages-rail__meta">
                          <strong>{previewTitle}</strong>
                          <small>
                            {channel.lastMessage
                              ? formatRelativeTime(channel.lastMessage.createdAt)
                              : channel.type}
                          </small>
                        </div>
                        <p>{previewSubtitle}</p>
                      </div>
                      <div className="messages-rail__status">
                        {counterpart ? (
                          <span className="messages-rail__presence-text">
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        ) : (
                          <span className="messages-rail__presence-text">
                            {channel.type === 'project' ? 'Project' : 'Team'}
                          </span>
                        )}
                        {unreadByChannel[channel.id] ? (
                          <Badge tone="danger">{unreadByChannel[channel.id]}</Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="messages-thread">
            {selectedChannel ? (
              <>
                <header className="messages-thread__header">
                  <div className="messages-thread__identity">
                    {selectedCounterpart ? (
                      <span
                        className={
                          presence[selectedCounterpart.uid]?.state === 'online'
                            ? 'presence-ring presence-ring--online'
                            : 'presence-ring presence-ring--offline'
                        }
                      >
                        <Avatar member={selectedCounterpart} shape="circle" />
                      </span>
                    ) : (
                      <span className="messages-thread__channel-badge">
                        <Hash size={18} />
                      </span>
                    )}
                    <div>
                      <strong>{selectedCounterpart?.name ?? selectedChannel.name}</strong>
                      <p>
                        {selectedChannel.type === 'direct'
                          ? presence[selectedCounterpart?.uid ?? '']?.state === 'online'
                            ? 'Available right now'
                            : 'Currently offline'
                          : `${selectedParticipants.length} participants in this channel`}
                      </p>
                    </div>
                  </div>
                  <div className="messages-thread__chips">
                    {selectedChannel.type === 'direct' ? (
                      <Badge
                        tone={
                          presence[selectedCounterpart?.uid ?? '']?.state === 'online'
                            ? 'success'
                            : 'neutral'
                        }
                      >
                        {presence[selectedCounterpart?.uid ?? '']?.state ?? 'offline'}
                      </Badge>
                    ) : (
                      selectedParticipants.slice(0, 3).map((participant) => (
                        <Avatar key={participant.uid} member={participant} size="sm" shape="circle" />
                      ))
                    )}
                  </div>
                </header>

                <div className="messages-thread__stream" ref={messageStreamRef}>
                  {messages.map((message) => {
                    const sender = members.find((entry) => entry.uid === message.senderId);
                    const mine = message.senderId === member?.uid;
                    return (
                      <article
                        key={message.id}
                        className={
                          mine
                            ? 'message-bubble-row message-bubble-row--mine'
                            : 'message-bubble-row'
                        }
                      >
                        {!mine ? (
                          <Avatar member={sender} size="sm" shape="circle" />
                        ) : null}
                        <div className={mine ? 'message-bubble message-bubble--mine' : 'message-bubble'}>
                          <div className="message-bubble__meta">
                            <strong>{mine ? 'You' : sender?.name ?? 'Team member'}</strong>
                            <small>{formatRelativeTime(message.createdAt)}</small>
                          </div>
                          <p>{message.body}</p>
                        </div>
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

                <div className="messages-thread__composer">
                  <MessageComposer
                    draft={draft}
                    onDraftChange={(value) => {
                      setDraftByChannel((current) => ({
                        ...current,
                        [selectedChannel.id]: value,
                      }));
                      void setTypingState(selectedChannel.id, value.trim().length > 0);
                    }}
                    onSend={() => handleSend()}
                  />
                </div>
              </>
            ) : (
              <EmptyState
                icon={MessageSquareShare}
                title="Choose a conversation"
                description="Pick a channel or direct message to start chatting."
              />
            )}
          </section>
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
