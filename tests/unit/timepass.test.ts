import { describe, expect, it } from 'vitest';

import {
  buildYouTubeMediaItem,
  calculatePlaybackPosition,
  canUseEmergencyOverride,
  createDefaultTimepassRoomState,
  createQueueItem,
  moveQueueItem,
  normalizeTimepassRoomState,
  removeQueueItem,
  stripUndefinedDeep,
} from '@/lib/timepass';

describe('timepass helpers', () => {
  it('extracts a YouTube video into queueable media metadata', () => {
    const media = buildYouTubeMediaItem({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      actorId: 'member-1',
      title: 'Friday drop',
      createdAt: '2026-04-16T10:00:00.000Z',
    });

    expect(media.youtubeVideoId).toBe('dQw4w9WgXcQ');
    expect(media.kind).toBe('youtube');
    expect(media.title).toBe('Friday drop');
  });

  it('normalizes queue order after moving and removing items', () => {
    const mediaA = buildYouTubeMediaItem({
      url: 'https://youtu.be/aaaaaaaaaaa',
      actorId: 'member-1',
      createdAt: '2026-04-16T10:00:00.000Z',
    });
    const mediaB = buildYouTubeMediaItem({
      url: 'https://youtu.be/bbbbbbbbbbb',
      actorId: 'member-1',
      createdAt: '2026-04-16T10:01:00.000Z',
    });
    const mediaC = buildYouTubeMediaItem({
      url: 'https://youtu.be/ccccccccccc',
      actorId: 'member-1',
      createdAt: '2026-04-16T10:02:00.000Z',
    });

    const first = createQueueItem({ media: mediaA, addedBy: 'member-1', existingQueue: [] });
    const second = createQueueItem({
      media: mediaB,
      addedBy: 'member-1',
      existingQueue: [first],
    });
    const third = createQueueItem({
      media: mediaC,
      addedBy: 'member-1',
      existingQueue: [first, second],
    });
    const queue = [first, second, third];

    const moved = moveQueueItem(queue, queue[2].id, 0);
    expect(moved.map((entry) => entry.mediaId)).toEqual([mediaC.id, mediaA.id, mediaB.id]);
    expect(moved.map((entry) => entry.order)).toEqual([0, 1, 2]);

    const removed = removeQueueItem(moved, moved[1].id);
    expect(removed.map((entry) => entry.mediaId)).toEqual([mediaC.id, mediaB.id]);
    expect(removed.map((entry) => entry.order)).toEqual([0, 1]);
  });

  it('keeps room defaults stable when realtime data is partial', () => {
    const normalized = normalizeTimepassRoomState(
      {
        queue: [{ id: 'item', order: 9, media: { id: 'media-1' } }],
        locks: {
          queueFrozen: true,
        },
      },
      'workspace-1',
    );

    expect(normalized.roomName).toBe('workspace:workspace-1:timepass');
    expect(normalized.queue[0].order).toBe(0);
    expect(normalized.locks.queueFrozen).toBe(true);
    expect(normalized.locks.stageFrozen).toBe(false);
    expect('updatedBy' in normalized.playback).toBe(false);
    expect('stopAllSharesAt' in normalized).toBe(false);
  });

  it('calculates shared playback drift and emergency permissions', () => {
    const state = createDefaultTimepassRoomState('workspace-1', '2026-04-16T10:00:00.000Z');
    state.playback = {
      isPlaying: true,
      positionSeconds: 12,
      playbackRate: 1,
      updatedAt: '2026-04-16T10:00:00.000Z',
    };

    expect(calculatePlaybackPosition(state.playback, Date.parse('2026-04-16T10:00:05.000Z'))).toBe(17);
    expect(canUseEmergencyOverride('founder')).toBe(true);
    expect(canUseEmergencyOverride('manager')).toBe(true);
    expect(canUseEmergencyOverride('member')).toBe(false);
  });

  it('removes undefined fields before data is sent to realtime database', () => {
    const sanitized = stripUndefinedDeep({
      playback: {
        updatedAt: '2026-04-16T10:00:00.000Z',
        updatedBy: undefined,
      },
      nested: {
        keep: 'yes',
        drop: undefined,
      },
    });

    expect(sanitized).toEqual({
      playback: {
        updatedAt: '2026-04-16T10:00:00.000Z',
      },
      nested: {
        keep: 'yes',
      },
    });
  });
});
