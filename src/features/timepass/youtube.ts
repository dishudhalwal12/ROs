export interface YouTubePlayerStateMap {
  ENDED: number;
  PLAYING: number;
  PAUSED: number;
  BUFFERING: number;
  CUED: number;
}

export interface YouTubePlayerInstance {
  destroy: () => void;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getAvailablePlaybackRates: () => number[];
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
}

export interface YouTubeApi {
  Player: new (
    element: HTMLElement,
    options: {
      width?: number | string;
      height?: number | string;
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayerInstance;
  PlayerState: YouTubePlayerStateMap;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null;

export function ensureYouTubeApi() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube is only available in the browser.'));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-youtube-iframe-api="true"]',
    );

    const handleReady = () => {
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube API did not load correctly.'));
      }
    };

    window.onYouTubeIframeAPIReady = handleReady;

    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      script.onerror = () => reject(new Error('Unable to load the YouTube IFrame API.'));
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

export function getClosestSupportedPlaybackRate(
  desiredRate: number,
  availableRates: number[],
) {
  if (availableRates.length === 0) return 1;

  return availableRates.reduce((closest, current) => {
    return Math.abs(current - desiredRate) < Math.abs(closest - desiredRate)
      ? current
      : closest;
  }, availableRates[0]);
}
