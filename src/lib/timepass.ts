import type {
  Role,
  TimepassMediaItem,
  TimepassPresenter,
  TimepassQueueItem,
  TimepassReactionKind,
  TimepassRoomState,
  TimepassVoiceMode,
} from '@/types/models';
import { generateToken, nowIso } from '@/lib/utils';

export const TIMEPASS_MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
export const TIMEPASS_SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
];

export const TIMEPASS_REACTION_CONFIG: Array<{
  kind: TimepassReactionKind;
  label: string;
  shortLabel: string;
}> = [
  { kind: 'woohoo', label: 'Woohoo', shortLabel: 'Woo' },
  { kind: 'yes', label: 'Yes', shortLabel: 'Yes' },
  { kind: 'clap', label: 'Clap', shortLabel: 'Clap' },
  { kind: 'fire', label: 'Fire', shortLabel: 'Fire' },
  { kind: 'lol', label: 'LOL', shortLabel: 'LOL' },
];

export function canUseEmergencyOverride(role?: Role | null) {
  return role === 'founder' || role === 'manager';
}

export function getTimepassRoomName(workspaceId: string) {
  return `workspace:${workspaceId}:timepass`;
}

export function extractYouTubeVideoId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }

      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/')[2] ?? null;
      }

      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] ?? null;
      }
    }
  } catch {
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

export function buildYouTubeMediaItem(input: {
  url: string;
  title?: string;
  actorId: string;
  createdAt?: string;
}) {
  const videoId = extractYouTubeVideoId(input.url);
  if (!videoId) {
    throw new Error('Enter a valid YouTube video URL.');
  }

  const createdAt = input.createdAt ?? nowIso();
  return {
    id: `youtube_${videoId}`,
    kind: 'youtube',
    title: input.title?.trim() || `YouTube • ${videoId}`,
    createdBy: input.actorId,
    createdAt,
    updatedAt: createdAt,
    youtubeVideoId: videoId,
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    accent: '#ff4d4d',
  } satisfies TimepassMediaItem;
}

export function createDefaultTimepassRoomState(
  workspaceId: string,
  createdAt = nowIso(),
): TimepassRoomState {
  return {
    roomName: getTimepassRoomName(workspaceId),
    activeMedia: null,
    queue: [],
    playback: {
      isPlaying: false,
      positionSeconds: 0,
      playbackRate: 1,
      updatedAt: createdAt,
    },
    presenters: [],
    pinnedStage: null,
    reactions: [],
    voiceModes: {},
    locks: {
      queueFrozen: false,
      stageFrozen: false,
      soundboardMuted: false,
    },
    updatedAt: createdAt,
  };
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) =>
        entry === undefined ? [] : [[key, stripUndefinedDeep(entry)]],
      ),
    ) as T;
  }

  return value;
}

export function normalizeTimepassRoomState(raw: unknown, workspaceId: string) {
  const fallback = createDefaultTimepassRoomState(workspaceId);

  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Partial<TimepassRoomState>;
  const queue = Array.isArray(candidate.queue)
    ? candidate.queue
        .filter((item): item is TimepassQueueItem => Boolean(item?.id && item.media))
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        .map((item, index) => ({ ...item, order: index }))
    : [];

  return stripUndefinedDeep({
    roomName: candidate.roomName ?? fallback.roomName,
    activeMedia: candidate.activeMedia ?? null,
    queue,
    playback: {
      isPlaying: candidate.playback?.isPlaying ?? false,
      positionSeconds: Math.max(0, candidate.playback?.positionSeconds ?? 0),
      playbackRate: Math.max(0.5, Math.min(1.5, candidate.playback?.playbackRate ?? 1)),
      updatedAt: candidate.playback?.updatedAt ?? fallback.playback.updatedAt,
      updatedBy: candidate.playback?.updatedBy,
    },
    presenters: Array.isArray(candidate.presenters) ? candidate.presenters : [],
    pinnedStage: candidate.pinnedStage ?? null,
    reactions: Array.isArray(candidate.reactions) ? candidate.reactions.slice(-12) : [],
    voiceModes: candidate.voiceModes ?? {},
    locks: {
      queueFrozen: candidate.locks?.queueFrozen ?? false,
      stageFrozen: candidate.locks?.stageFrozen ?? false,
      soundboardMuted: candidate.locks?.soundboardMuted ?? false,
    },
    stopAllSharesAt: candidate.stopAllSharesAt,
    lastResetAt: candidate.lastResetAt,
    updatedAt: candidate.updatedAt ?? fallback.updatedAt,
  } satisfies TimepassRoomState);
}

export function calculatePlaybackPosition(
  state: TimepassRoomState['playback'],
  now = Date.now(),
) {
  if (!state.isPlaying) {
    return state.positionSeconds;
  }

  const updatedAt = new Date(state.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) {
    return state.positionSeconds;
  }

  const elapsedSeconds = Math.max(0, (now - updatedAt) / 1000);
  return state.positionSeconds + elapsedSeconds * state.playbackRate;
}

export function shouldResyncPlayback(localPosition: number, targetPosition: number) {
  return Math.abs(localPosition - targetPosition) > 0.75;
}

export function createQueueItem(input: {
  media: TimepassMediaItem;
  addedBy: string;
  addedAt?: string;
  existingQueue: TimepassQueueItem[];
}) {
  const addedAt = input.addedAt ?? nowIso();
  return {
    id: generateToken('timepass_queue'),
    mediaId: input.media.id,
    addedBy: input.addedBy,
    addedAt,
    order: input.existingQueue.length,
    media: input.media,
  } satisfies TimepassQueueItem;
}

export function moveQueueItem(
  queue: TimepassQueueItem[],
  itemId: string,
  targetIndex: number,
) {
  const currentIndex = queue.findIndex((item) => item.id === itemId);
  if (currentIndex === -1) return ensureQueueOrder(queue);

  const boundedTarget = Math.max(0, Math.min(targetIndex, queue.length - 1));
  const reordered = queue.slice();
  const [item] = reordered.splice(currentIndex, 1);
  reordered.splice(boundedTarget, 0, item);
  return ensureQueueOrder(reordered);
}

export function removeQueueItem(queue: TimepassQueueItem[], itemId: string) {
  return ensureQueueOrder(queue.filter((item) => item.id !== itemId));
}

export function ensureQueueOrder(queue: TimepassQueueItem[]) {
  return queue.map((item, index) => ({ ...item, order: index }));
}

export function getNextQueueItem(state: TimepassRoomState) {
  if (state.queue.length === 0) return null;
  if (!state.activeMedia) return state.queue[0];

  const currentIndex = state.queue.findIndex((entry) => entry.mediaId === state.activeMedia?.id);
  if (currentIndex === -1) return state.queue[0];

  return state.queue[currentIndex + 1] ?? null;
}

export function upsertPresenter(
  presenters: TimepassPresenter[],
  presenter: TimepassPresenter,
) {
  const withoutExisting = presenters.filter((entry) => entry.id !== presenter.id);
  return [...withoutExisting, presenter].sort((left, right) =>
    left.startedAt.localeCompare(right.startedAt),
  );
}

export function removePresenter(
  presenters: TimepassPresenter[],
  presenterId: string,
) {
  return presenters.filter((entry) => entry.id !== presenterId);
}

export function defaultVoiceModeForMember(
  voiceModes: Record<string, TimepassVoiceMode>,
  memberId: string,
) {
  return voiceModes[memberId] ?? 'push_to_talk';
}
