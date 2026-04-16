export interface TimepassDuckingSnapshot {
  gain: number;
  rate: number;
  transitionMs: number;
}

const listeners = new Set<(snapshot: TimepassDuckingSnapshot) => void>();
const defaultSnapshot: TimepassDuckingSnapshot = {
  gain: 1,
  rate: 1,
  transitionMs: 180,
};

let currentSnapshot = defaultSnapshot;
let releaseTimeout: number | undefined;

function publish(snapshot: TimepassDuckingSnapshot) {
  currentSnapshot = snapshot;
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribeToTimepassDucking(
  listener: (snapshot: TimepassDuckingSnapshot) => void,
) {
  listeners.add(listener);
  listener(currentSnapshot);

  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentTimepassDucking() {
  return currentSnapshot;
}

export function triggerTimepassNotificationDucking() {
  publish({
    gain: 0.55,
    rate: 0.96,
    transitionMs: 120,
  });

  if (releaseTimeout) {
    window.clearTimeout(releaseTimeout);
  }

  releaseTimeout = window.setTimeout(() => {
    publish({
      gain: 1,
      rate: 1,
      transitionMs: 1200,
    });
  }, 350);
}
