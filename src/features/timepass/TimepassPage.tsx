import {
  AnimatePresence,
  motion,
} from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Lock,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorPlay,
  Music4,
  Pause,
  Play,
  PlaySquare,
  Plus,
  Radio,
  ScreenShare,
  SkipForward,
  Trash2,
  Unlock,
  Upload,
  UsersRound,
} from 'lucide-react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useTimepass } from '@/features/timepass/use-timepass';
import { playReactionFx } from '@/features/timepass/timepass-sfx';
import {
  ensureYouTubeApi,
  getClosestSupportedPlaybackRate,
  getYouTubePlayerVars,
  type YouTubePlayerInstance,
} from '@/features/timepass/youtube';
import {
  TIMEPASS_REACTION_CONFIG,
  shouldResyncPlayback,
} from '@/lib/timepass';
import { cn } from '@/lib/utils';
import type { TimepassMediaItem } from '@/types/models';

function formatSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function AlertBanner({
  tone,
  message,
}: {
  tone: 'warning' | 'danger' | 'info';
  message: string;
}) {
  return (
    <div className={cn('timepass-alert', `timepass-alert--${tone}`)}>
      <CircleAlert size={16} />
      <span>{message}</span>
    </div>
  );
}

function PresenterSurface({
  title,
  subtitle,
  videoTrack,
  audioTrack,
  isLocal,
  duckingGain,
  duckingRate,
}: {
  title: string;
  subtitle: string;
  videoTrack: { attach: (element: HTMLMediaElement) => HTMLMediaElement; detach: (element?: HTMLMediaElement) => void } | null;
  audioTrack: { attach: (element: HTMLMediaElement) => HTMLMediaElement; detach: (element?: HTMLMediaElement) => void } | null;
  isLocal: boolean;
  duckingGain: number;
  duckingRate: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || !videoTrack) return;

    videoTrack.attach(element);
    element.muted = true;
    element.playsInline = true;

    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !audioTrack || isLocal) return;

    audioTrack.attach(element);
    element.autoplay = true;
    element.volume = duckingGain;
    element.playbackRate = duckingRate;

    return () => {
      audioTrack.detach(element);
    };
  }, [audioTrack, duckingGain, duckingRate, isLocal]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = duckingGain;
      audioRef.current.playbackRate = duckingRate;
    }
    if (videoRef.current) {
      videoRef.current.playbackRate = duckingRate;
    }
  }, [duckingGain, duckingRate]);

  return (
    <div className="timepass-stage-card timepass-stage-card--presenter">
      <div className="timepass-stage-card__meta">
        <div>
          <Badge tone="info">Live share</Badge>
          <strong>{title}</strong>
          <p>{subtitle}</p>
        </div>
      </div>
      <video ref={videoRef} className="timepass-stage-card__video" autoPlay muted playsInline />
      <audio ref={audioRef} autoPlay />
    </div>
  );
}

function UploadPlaybackSurface({
  media,
  isPlaying,
  currentPositionSeconds,
  duckingGain,
  duckingRate,
  visible,
  onEnded,
}: {
  media: TimepassMediaItem;
  isPlaying: boolean;
  currentPositionSeconds: number;
  duckingGain: number;
  duckingRate: number;
  visible: boolean;
  onEnded: (mediaId: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !media.url) return;
    if (element.src !== media.url) {
      element.src = media.url;
      element.load();
    }
  }, [media.url]);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const sync = async () => {
      if (shouldResyncPlayback(element.currentTime, currentPositionSeconds)) {
        element.currentTime = currentPositionSeconds;
      }

      element.volume = duckingGain;
      element.playbackRate = duckingRate;

      if (isPlaying) {
        try {
          await element.play();
        } catch {
          // Ignore autoplay-policy failures until user interacts.
        }
      } else {
        element.pause();
      }
    };

    void sync();
  }, [currentPositionSeconds, duckingGain, duckingRate, isPlaying]);

  return (
    <div
      className={cn(
        'timepass-stage-card',
        'timepass-stage-card--music',
        !visible && 'timepass-stage-card--secondary',
      )}
    >
      <audio
        ref={audioRef}
        onEnded={() => onEnded(media.id)}
        preload="auto"
      />
      <div className="timepass-stage-card__meta">
        <div>
          <Badge tone="success">Hi-fi room audio</Badge>
          <strong>{media.title}</strong>
          <p>{media.description || 'Shared from the Rovexa lounge library.'}</p>
        </div>
        <div className="timepass-stage-card__stats">
          <span>{formatSeconds(currentPositionSeconds)}</span>
          <span>{media.contentType?.replace('audio/', '') || 'lossless-ready'}</span>
        </div>
      </div>
      <div className="timepass-wave">
        {Array.from({ length: 16 }, (_, index) => (
          <span
            key={index}
            className={cn(isPlaying && 'timepass-wave__bar--active')}
            style={{ animationDelay: `${index * 0.08}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function YouTubeStage({
  media,
  isPlaying,
  currentPositionSeconds,
  duckingGain,
  onEnded,
}: {
  media: TimepassMediaItem;
  isPlaying: boolean;
  currentPositionSeconds: number;
  duckingGain: number;
  onEnded: (mediaId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const playerReadyRef = useRef(false);
  const loadedVideoIdRef = useRef<string | null>(null);
  const onEndedRef = useRef(onEnded);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    let cancelled = false;

    if (!containerRef.current || !media.youtubeVideoId) return;

    void ensureYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;

        playerReadyRef.current = false;
        loadedVideoIdRef.current = null;
        playerRef.current = new YT.Player(containerRef.current, {
          host: 'https://www.youtube-nocookie.com',
          videoId: media.youtubeVideoId,
          playerVars: getYouTubePlayerVars(),
          events: {
            onReady: () => {
              playerReadyRef.current = true;
              loadedVideoIdRef.current = null;
              setApiError(null);
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.ENDED) {
                onEndedRef.current(media.id);
              }
            },
          },
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setApiError(error instanceof Error ? error.message : 'Unable to load YouTube.');
        }
      });

    return () => {
      cancelled = true;
      playerReadyRef.current = false;
      loadedVideoIdRef.current = null;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [media.id, media.youtubeVideoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current || !media.youtubeVideoId) return;

    if (loadedVideoIdRef.current !== media.youtubeVideoId) {
      if (isPlaying && typeof player.loadVideoById === 'function') {
        player.loadVideoById(media.youtubeVideoId, currentPositionSeconds);
      } else if (typeof player.cueVideoById === 'function') {
        player.cueVideoById(media.youtubeVideoId, currentPositionSeconds);
      }

      loadedVideoIdRef.current = media.youtubeVideoId;
      return;
    }

    const currentTime = player.getCurrentTime?.() ?? 0;
    if (shouldResyncPlayback(currentTime, currentPositionSeconds)) {
      player.seekTo?.(currentPositionSeconds, true);
    }

    player.setVolume?.(Math.round(duckingGain * 100));

    const supportedRates = player.getAvailablePlaybackRates?.() ?? [];
    const rate = getClosestSupportedPlaybackRate(1, supportedRates);
    player.setPlaybackRate?.(rate);

    if (isPlaying) {
      player.playVideo?.();
    } else {
      player.pauseVideo?.();
    }
  }, [currentPositionSeconds, duckingGain, isPlaying, media.youtubeVideoId]);

  return (
    <div className="timepass-stage-card timepass-stage-card--youtube">
      <div className="timepass-stage-card__meta">
        <div>
          <Badge tone="danger">Watch party</Badge>
          <strong>{media.title}</strong>
          <p>Synced YouTube playback for the whole team.</p>
        </div>
      </div>
      {apiError ? <AlertBanner tone="danger" message={apiError} /> : null}
      <div ref={containerRef} className="timepass-stage-card__video-frame" />
    </div>
  );
}

export function TimepassPage() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [youtubeUrl, setYouTubeUrl] = useState('');
  const [youtubeTitle, setYouTubeTitle] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [lastReactionId, setLastReactionId] = useState<string | null>(null);
  const {
    roomState,
    uploads,
    liveState,
    liveError,
    actionError,
    emergencyOverride,
    voiceMode,
    isPushToTalkActive,
    isMicLive,
    isSharingScreen,
    ducking,
    participants,
    presenters,
    currentPositionSeconds,
    addYouTubeToQueue,
    addUploadToQueue,
    uploadMedia,
    deleteMedia,
    playQueueItem,
    togglePlayback,
    seekPlayback,
    skipToNext,
    advanceQueueFromMedia,
    removeQueueItem,
    moveQueueItem,
    pinPresenter,
    pinMedia,
    clearPinnedStage,
    emitReaction,
    setVoiceMode,
    beginPushToTalk,
    endPushToTalk,
    toggleOpenMic,
    toggleScreenShare,
    setQueueFrozen,
    setStageFrozen,
    setSoundboardMuted,
    stopAllShares,
    resetRoom,
    clearActionError,
  } = useTimepass();

  const activeMedia = roomState.activeMedia;
  const pinnedPresenter = presenters.find(
    (presenter) => presenter.id === roomState.pinnedStage?.presenterId,
  );
  const stagePrefersPresenter =
    activeMedia?.kind !== 'youtube' &&
    roomState.pinnedStage?.kind === 'presenter' &&
    pinnedPresenter;
  const stageUploadVisible = activeMedia?.kind === 'upload' && !stagePrefersPresenter;
  const currentQueueItem = roomState.queue.find((item) => item.mediaId === activeMedia?.id) ?? null;
  const durationSeconds = activeMedia?.durationSeconds ?? 0;

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const latestReaction = roomState.reactions[roomState.reactions.length - 1];
    if (!latestReaction || latestReaction.id === lastReactionId) return;
    setLastReactionId(latestReaction.id);
    void playReactionFx(latestReaction.kind);
  }, [lastReactionId, roomState.reactions]);

  const runUiTask = useCallback((task: Promise<unknown>) => {
    void task.catch(() => undefined);
  }, []);

  async function handleFullscreenToggle() {
    if (!rootRef.current) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await rootRef.current.requestFullscreen();
  }

  async function handleYouTubeSubmit() {
    if (!youtubeUrl.trim()) return;
    await addYouTubeToQueue(youtubeUrl, youtubeTitle);
    setYouTubeUrl('');
    setYouTubeTitle('');
  }

  async function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadMedia(file);
    event.target.value = '';
  }

  const progressValue = durationSeconds
    ? Math.min(100, (currentPositionSeconds / durationSeconds) * 100)
    : 0;

  const soundboardButtons = useMemo(() => TIMEPASS_REACTION_CONFIG, []);
  const handleMediaEnded = useCallback(
    (mediaId: string) => {
      runUiTask(advanceQueueFromMedia(mediaId));
    },
    [advanceQueueFromMedia, runUiTask],
  );

  return (
    <div ref={rootRef} className="timepass-page">
      <div className="timepass-page__ambient timepass-page__ambient--one" />
      <div className="timepass-page__ambient timepass-page__ambient--two" />

      <div className="timepass-page__chrome">
        <div className="timepass-topbar">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/time')}
          >
            <ArrowLeft size={16} />
            Back to Time
          </button>

          <div className="timepass-topbar__title">
            <span className="eyebrow">Timepass</span>
            <h1>The Rovexa lounge</h1>
            <p>Watch, talk, DJ, share research, and hang out without leaving the dashboard.</p>
          </div>

          <div className="timepass-topbar__actions">
            <Badge tone={liveState === 'connected' ? 'success' : liveState === 'error' ? 'danger' : 'warning'}>
              {liveState}
            </Badge>
            <button
              type="button"
              className="icon-button"
              onClick={() => void handleFullscreenToggle()}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        {liveError ? <AlertBanner tone="warning" message={liveError} /> : null}
        {actionError ? (
          <div className="timepass-alert-shell">
            <AlertBanner tone="danger" message={actionError} />
            <button type="button" className="text-button" onClick={clearActionError}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="timepass-dashboard">
          <section className="timepass-stage">
            <div className="timepass-stage__header">
              <div>
                <Badge tone="info">Main stage</Badge>
                <h2>
                  {stagePrefersPresenter
                    ? pinnedPresenter.member?.name ?? pinnedPresenter.memberName
                    : activeMedia?.title ?? 'The room is warming up'}
                </h2>
                <p>
                  {stagePrefersPresenter
                    ? 'Pinned live share for the whole room.'
                    : activeMedia?.kind === 'youtube'
                      ? 'Synced YouTube watch party.'
                      : activeMedia?.kind === 'upload'
                        ? 'High-quality room audio, perfectly synced.'
                        : 'Jump into music, research, memes, and spontaneous team time.'}
                </p>
              </div>

              <div className="timepass-stage__header-actions">
                {roomState.pinnedStage ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => runUiTask(clearPinnedStage())}
                  >
                    Clear pin
                  </button>
                ) : null}
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => runUiTask(toggleScreenShare())}
                  disabled={liveState !== 'connected'}
                >
                  <ScreenShare size={16} />
                  {isSharingScreen ? 'Stop share' : 'Share tab or screen'}
                </button>
              </div>
            </div>

            {activeMedia?.kind === 'upload' ? (
              <UploadPlaybackSurface
                media={activeMedia}
                isPlaying={roomState.playback.isPlaying}
                currentPositionSeconds={currentPositionSeconds}
                duckingGain={ducking.gain}
                duckingRate={ducking.rate}
                visible={stageUploadVisible}
                onEnded={handleMediaEnded}
              />
            ) : null}

            {activeMedia?.kind === 'youtube' ? (
              <YouTubeStage
                media={activeMedia}
                isPlaying={roomState.playback.isPlaying}
                currentPositionSeconds={currentPositionSeconds}
                duckingGain={ducking.gain}
                onEnded={handleMediaEnded}
              />
            ) : stagePrefersPresenter ? (
              <PresenterSurface
                title={pinnedPresenter.member?.name ?? pinnedPresenter.memberName}
                subtitle={pinnedPresenter.presentationLabel}
                videoTrack={pinnedPresenter.videoTrack}
                audioTrack={pinnedPresenter.audioTrack}
                isLocal={pinnedPresenter.isLocal}
                duckingGain={ducking.gain}
                duckingRate={ducking.rate}
              />
            ) : !stageUploadVisible ? (
              <div className="timepass-stage-card timepass-stage-card--empty">
                <div className="timepass-stage-card__meta">
                  <div>
                    <Badge tone="neutral">Lounge mode</Badge>
                    <strong>Queue a track, paste a YouTube link, or start a share</strong>
                    <p>The first big thing you play becomes the vibe of the room.</p>
                  </div>
                </div>
                <div className="timepass-stage-card__empty-grid">
                  <div>
                    <Music4 size={18} />
                    <span>Premium uploaded music</span>
                  </div>
                  <div>
                    <PlaySquare size={18} />
                    <span>Watch-party videos</span>
                  </div>
                  <div>
                    <MonitorPlay size={18} />
                    <span>Screen & tab share with audio</span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="timepass-controls">
              <div className="timepass-controls__playback">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => runUiTask(togglePlayback())}
                  disabled={!activeMedia}
                  aria-label={roomState.playback.isPlaying ? 'Pause' : 'Play'}
                >
                  {roomState.playback.isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => runUiTask(skipToNext())}
                  disabled={roomState.queue.length === 0}
                  aria-label="Skip to next"
                >
                  <SkipForward size={18} />
                </button>
                <div className="timepass-progress">
                  <div className="timepass-progress__labels">
                    <span>{formatSeconds(currentPositionSeconds)}</span>
                    <span>{durationSeconds ? formatSeconds(durationSeconds) : 'Live'}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(durationSeconds, currentPositionSeconds, 1)}
                    value={Math.min(currentPositionSeconds, Math.max(durationSeconds, 1))}
                    onChange={(event) => runUiTask(seekPlayback(Number(event.target.value)))}
                    disabled={!activeMedia}
                  />
                  <div className="timepass-progress__meter">
                    <span style={{ width: `${progressValue}%` }} />
                  </div>
                </div>
              </div>

              <div className="timepass-controls__voice">
                <div className="toggle-group">
                  <button
                    type="button"
                    className={cn('toggle-button', voiceMode === 'push_to_talk' && 'toggle-button--active')}
                    onClick={() => runUiTask(setVoiceMode('push_to_talk'))}
                  >
                    <Radio size={15} />
                    Push to talk
                  </button>
                  <button
                    type="button"
                    className={cn('toggle-button', voiceMode === 'open_mic' && 'toggle-button--active')}
                    onClick={() => runUiTask(setVoiceMode('open_mic'))}
                  >
                    <UsersRound size={15} />
                    Open mic
                  </button>
                </div>

                {voiceMode === 'push_to_talk' ? (
                  <button
                    type="button"
                    className={cn(
                      'primary-button',
                      isPushToTalkActive && 'timepass-hold-button--active',
                    )}
                    onMouseDown={() => runUiTask(beginPushToTalk())}
                    onMouseUp={() => runUiTask(endPushToTalk())}
                    onMouseLeave={() => runUiTask(endPushToTalk())}
                    onTouchStart={() => runUiTask(beginPushToTalk())}
                    onTouchEnd={() => runUiTask(endPushToTalk())}
                    disabled={liveState === 'connecting'}
                  >
                    <Mic size={16} />
                    {isPushToTalkActive ? 'Talking… release to mute' : 'Hold to talk'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={cn('primary-button', isMicLive && 'timepass-open-mic-button--live')}
                    onClick={() => runUiTask(toggleOpenMic())}
                    disabled={liveState === 'connecting'}
                  >
                    {isMicLive ? <MicOff size={16} /> : <Mic size={16} />}
                    {isMicLive ? 'Mute mic' : 'Open mic'}
                  </button>
                )}
              </div>
            </div>

            {presenters.length > 0 ? (
              <div className="timepass-presenter-tray">
                {presenters.map((presenter) => (
                  <article key={presenter.id} className="timepass-presenter-tile">
                    <div>
                      <strong>{presenter.member?.name ?? presenter.memberName}</strong>
                      <p>{presenter.presentationLabel}</p>
                    </div>
                    <div className="timepass-presenter-tile__actions">
                      {presenter.withAudio ? <Badge tone="success">audio on</Badge> : null}
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => runUiTask(pinPresenter(presenter.id))}
                      >
                        Spotlight
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="timepass-reactions">
              {soundboardButtons.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className="timepass-reactions__button"
                  onClick={() => runUiTask(emitReaction(item.kind))}
                  disabled={roomState.locks.soundboardMuted}
                >
                  {item.shortLabel}
                </button>
              ))}
            </div>

            <div className="timepass-participants">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className={cn(
                    'timepass-participants__item',
                    participant.isSpeaking && 'timepass-participants__item--speaking',
                  )}
                >
                  <Avatar member={participant.member} label={participant.name} shape="circle" />
                  <div>
                    <strong>{participant.isLocal ? 'You' : participant.name}</strong>
                    <small>
                      {participant.voiceMode === 'push_to_talk' ? 'PTT' : 'Open mic'}
                      {participant.isPresenting ? ' • presenting' : ''}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="timepass-sidepanel">
            <div className="timepass-sidepanel__section">
              <div className="timepass-sidepanel__header">
                <div>
                  <h3>Queue</h3>
                  <p>Everyone can DJ the room together.</p>
                </div>
                <Badge tone={roomState.locks.queueFrozen ? 'warning' : 'success'}>
                  {roomState.locks.queueFrozen ? 'locked' : 'live'}
                </Badge>
              </div>

              <div className="timepass-queue">
                {roomState.queue.length === 0 ? (
                  <p className="timepass-empty-copy">
                    Add uploads or a YouTube link to start the lounge.
                  </p>
                ) : (
                  roomState.queue.map((item, index) => (
                    <article
                      key={item.id}
                      className={cn(
                        'timepass-queue__item',
                        currentQueueItem?.id === item.id && 'timepass-queue__item--active',
                      )}
                    >
                      <div>
                        <strong>{item.media.title}</strong>
                        <p>{item.media.kind === 'youtube' ? 'YouTube' : 'Uploaded audio'}</p>
                      </div>
                      <div className="timepass-queue__actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => runUiTask(playQueueItem(item.id))}
                          aria-label={`Play ${item.media.title}`}
                        >
                          <Play size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => runUiTask(pinMedia(item.media.id))}
                          aria-label={`Pin ${item.media.title} to stage`}
                        >
                          <MonitorPlay size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => runUiTask(moveQueueItem(item.id, index - 1))}
                          disabled={index === 0}
                          aria-label="Move up"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => runUiTask(moveQueueItem(item.id, index + 1))}
                          disabled={index === roomState.queue.length - 1}
                          aria-label="Move down"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => runUiTask(removeQueueItem(item.id))}
                          aria-label="Remove from queue"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="timepass-sidepanel__section">
              <div className="timepass-sidepanel__header">
                <div>
                  <h3>Watch party</h3>
                  <p>Paste a YouTube link and sync it for everyone.</p>
                </div>
                <PlaySquare size={18} />
              </div>

              <label>
                <span>YouTube URL</span>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(event) => setYouTubeUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>
              <label>
                <span>Optional title</span>
                <input
                  type="text"
                  value={youtubeTitle}
                  onChange={(event) => setYouTubeTitle(event.target.value)}
                  placeholder="Funny market research"
                />
              </label>
              <button
                type="button"
                className="primary-button"
                onClick={() => runUiTask(handleYouTubeSubmit())}
              >
                <Plus size={16} />
                Add to queue
              </button>
            </div>

            <div className="timepass-sidepanel__section">
              <div className="timepass-sidepanel__header">
                <div>
                  <h3>Uploads</h3>
                  <p>High-quality shared room audio from your own files.</p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload size={16} />
                  Upload
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".mp3,.m4a,.aac,.wav,.flac,audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/flac"
                  hidden
                  onChange={(event) => runUiTask(handleUploadChange(event))}
                />
              </div>

              <div className="timepass-library">
                {uploads.length === 0 ? (
                  <p className="timepass-empty-copy">
                    Upload your favorite track and it becomes part of the room.
                  </p>
                ) : (
                  uploads.map((media) => (
                    <article key={media.id} className="timepass-library__item">
                      <div>
                        <strong>{media.title}</strong>
                        <p>{media.contentType?.replace('audio/', '') || 'uploaded audio'}</p>
                      </div>
                      <div className="timepass-library__actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => runUiTask(addUploadToQueue(media))}
                        >
                          <Plus size={16} />
                          Queue
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => runUiTask(deleteMedia(media))}
                          aria-label={`Delete ${media.title}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            {emergencyOverride ? (
              <div className="timepass-sidepanel__section timepass-sidepanel__section--danger">
                <div className="timepass-sidepanel__header">
                  <div>
                    <h3>Emergency controls</h3>
                    <p>Freeze chaos or reset the room if things go sideways.</p>
                  </div>
                  <Badge tone="warning">Leadership</Badge>
                </div>

                <div className="timepass-lock-grid">
                  <button
                    type="button"
                    className={cn('toggle-button', roomState.locks.queueFrozen && 'toggle-button--active')}
                    onClick={() => runUiTask(setQueueFrozen(!roomState.locks.queueFrozen))}
                  >
                    {roomState.locks.queueFrozen ? <Lock size={15} /> : <Unlock size={15} />}
                    Queue {roomState.locks.queueFrozen ? 'locked' : 'open'}
                  </button>
                  <button
                    type="button"
                    className={cn('toggle-button', roomState.locks.stageFrozen && 'toggle-button--active')}
                    onClick={() => runUiTask(setStageFrozen(!roomState.locks.stageFrozen))}
                  >
                    {roomState.locks.stageFrozen ? <Lock size={15} /> : <Unlock size={15} />}
                    Stage {roomState.locks.stageFrozen ? 'locked' : 'open'}
                  </button>
                  <button
                    type="button"
                    className={cn('toggle-button', roomState.locks.soundboardMuted && 'toggle-button--active')}
                    onClick={() =>
                      runUiTask(setSoundboardMuted(!roomState.locks.soundboardMuted))
                    }
                  >
                    {roomState.locks.soundboardMuted ? <Lock size={15} /> : <Unlock size={15} />}
                    Soundboard {roomState.locks.soundboardMuted ? 'muted' : 'live'}
                  </button>
                </div>

                <div className="timepass-sidepanel__footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => runUiTask(stopAllShares())}
                  >
                    Stop all shares
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => runUiTask(resetRoom())}
                  >
                    Reset room
                  </button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {roomState.reactions.slice(-6).map((reaction, index) => {
          const label =
            soundboardButtons.find((item) => item.kind === reaction.kind)?.label ?? reaction.kind;
          return (
            <motion.div
              key={reaction.id}
              className="timepass-reaction-burst"
              initial={{ opacity: 0, y: 24, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -32, scale: 1.04 }}
              transition={{ duration: 0.28 }}
              style={{
                left: `${12 + index * 14}%`,
                animationDelay: `${index * 0.06}s`,
              }}
            >
              <strong>{label}</strong>
              <small>{reaction.actorName}</small>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
