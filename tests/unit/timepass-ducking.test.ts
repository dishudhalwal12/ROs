import { describe, expect, it, vi } from 'vitest';

import {
  getCurrentTimepassDucking,
  subscribeToTimepassDucking,
  triggerTimepassNotificationDucking,
} from '@/lib/timepass-ducking';

describe('timepass ducking', () => {
  it('drops the local gain and restores it after the release window', () => {
    vi.useFakeTimers();

    const snapshots = [getCurrentTimepassDucking()];
    const unsubscribe = subscribeToTimepassDucking((snapshot) => {
      snapshots.push(snapshot);
    });

    triggerTimepassNotificationDucking();

    expect(snapshots.at(-1)).toMatchObject({
      gain: 0.55,
      rate: 0.96,
    });

    vi.advanceTimersByTime(350);

    expect(snapshots.at(-1)).toMatchObject({
      gain: 1,
      rate: 1,
      transitionMs: 1200,
    });

    unsubscribe();
    vi.useRealTimers();
  });
});
