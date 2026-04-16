import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { onValue, ref, runTransaction, update } from 'firebase/database';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import {
  AudioPresets,
  ConnectionState,
  LocalTrack,
  type LocalAudioTrack,
  type Participant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
} from 'livekit-client';
import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';
import { db, isRealtimeConfigured, realtimeDb, storage } from '@/lib/firebase';
import {
  getCurrentTimepassDucking,
  subscribeToTimepassDucking,
  type TimepassDuckingSnapshot,
} from '@/lib/timepass-ducking';
import { primeTimepassAudio } from './timepass-sfx';
import {
  TIMEPASS_MAX_UPLOAD_BYTES,
  TIMEPASS_SUPPORTED_AUDIO_TYPES,
  buildYouTubeMediaItem,
  calculatePlaybackPosition,
  canUseEmergencyOverride,
  createDefaultTimepassRoomState,
  createQueueItem,
  defaultVoiceModeForMember,
  ensureQueueOrder,
  getNextQueueItem,
  moveQueueItem,
  normalizeTimepassRoomState,
  removePresenter,
  removeQueueItem,
  stripUndefinedDeep,
  upsertPresenter,
} from '@/lib/timepass';
import { generateToken, nowIso } from '@/lib/utils';
import type {
  Member,
  TimepassMediaItem,
  TimepassPresenter,
  TimepassReactionKind,
  TimepassRoomState,
  TimepassVoiceMode,
} from '@/types/models';

export type TimepassLiveState = 'disabled' | 'connecting' | 'connected' | 'error';

export interface TimepassParticipantSummary {
  id: string;
  name: string;
  member: Member | null;
  isLocal: boolean;
  isSpeaking: boolean;
  isPresenting: boolean;
  voiceMode: TimepassVoiceMode;
}

export interface TimepassPresenterTrack extends TimepassPresenter {
  isLocal: boolean;
  member: Member | null;
  videoTrack: LocalTrack | RemoteTrack | null;
  audioTrack: LocalTrack | RemoteTrack | null;
}

interface TimepassContextValue {
  roomState: TimepassRoomState;
  uploads: TimepassMediaItem[];
  liveState: TimepassLiveState;
  liveError: string | null;
  actionError: string | null;
  emergencyOverride: boolean;
  voiceMode: TimepassVoiceMode;
  isPushToTalkActive: boolean;
  isMicLive: boolean;
  isSharingScreen: boolean;
  ducking: TimepassDuckingSnapshot;
  participants: TimepassParticipantSummary[];
  presenters: TimepassPresenterTrack[];
  currentPositionSeconds: number;
  addYouTubeToQueue: (url: string, title?: string) => Promise<void>;
  addUploadToQueue: (media: TimepassMediaItem) => Promise<void>;
  uploadMedia: (file: File) => Promise<void>;
  deleteMedia: (media: TimepassMediaItem) => Promise<void>;
  playQueueItem: (itemId: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
  seekPlayback: (seconds: number) => Promise<void>;
  skipToNext: () => Promise<void>;
  advanceQueueFromMedia: (mediaId: string) => Promise<void>;
  removeQueueItem: (itemId: string) => Promise<void>;
  moveQueueItem: (itemId: string, targetIndex: number) => Promise<void>;
  pinPresenter: (presenterId: string) => Promise<void>;
  pinMedia: (mediaId: string) => Promise<void>;
  clearPinnedStage: () => Promise<void>;
  emitReaction: (kind: TimepassReactionKind) => Promise<void>;
  setVoiceMode: (mode: TimepassVoiceMode) => Promise<void>;
  beginPushToTalk: () => Promise<void>;
  endPushToTalk: () => Promise<void>;
  toggleOpenMic: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  setQueueFrozen: (value: boolean) => Promise<void>;
  setStageFrozen: (value: boolean) => Promise<void>;
  setSoundboardMuted: (value: boolean) => Promise<void>;
  stopAllShares: () => Promise<void>;
  resetRoom: () => Promise<void>;
  clearActionError: () => void;
}

export const TimepassContext = createContext<TimepassContextValue | null>(null);

const livekitUrl = import.meta.env.VITE_LIVEKIT_WS_URL?.trim();

function getLivekitConfigError(rawLivekitUrl: string | undefined) {
  if (!rawLivekitUrl) {
    return 'Set VITE_LIVEKIT_WS_URL to enable Timepass voice and live sharing.';
  }

  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    rawLivekitUrl.startsWith('ws://')
  ) {
    return 'Set VITE_LIVEKIT_WS_URL to a secure wss:// address for HTTPS deployments like Vercel.';
  }

  return null;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function resolveParticipantByIdentity(room: Room, identity: string) {
  if (room.localParticipant.identity === identity) {
    return room.localParticipant;
  }

  return Array.from(room.remoteParticipants.values()).find(
    (participant) => participant.identity === identity,
  );
}

function createMicrophoneOptions() {
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

function createScreenShareOptions() {
  return {
    audio: true,
    systemAudio: 'include' as const,
    preferCurrentTab: true,
    surfaceSwitching: 'include' as const,
    selfBrowserSurface: 'include' as const,
    suppressLocalAudioPlayback: false,
  };
}

export function TimepassProvider({ children }: PropsWithChildren) {
  const { member, user, workspaceId } = useAuth();
  const { members } = useWorkspace();
  const [roomState, setRoomState] = useState<TimepassRoomState>(() =>
    createDefaultTimepassRoomState(workspaceId ?? 'workspace'),
  );
  const [uploads, setUploads] = useState<TimepassMediaItem[]>([]);
  const [liveState, setLiveState] = useState<TimepassLiveState>('disabled');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [roomRevision, setRoomRevision] = useState(0);
  const [ducking, setDucking] = useState<TimepassDuckingSnapshot>(getCurrentTimepassDucking());
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const [isMicLive, setIsMicLive] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());

  const emergencyOverride = canUseEmergencyOverride(member?.role);
  const livekitConfigError = getLivekitConfigError(livekitUrl);
  const resolvedLivekitUrl = livekitConfigError ? null : livekitUrl;
  const roomRef = useRef<Room | null>(null);
  const presenterSyncRef = useRef({
    sharing: false,
    withAudio: false,
  });
  const lastStopSharesHandledRef = useRef<string | null>(null);
  const lastResetHandledRef = useRef<string | null>(null);
  const reactionThrottleRef = useRef(0);
  const micMutationRef = useRef<Promise<void> | null>(null);
  const micTrackRef = useRef<LocalAudioTrack | null>(null);
  const micTrackPromiseRef = useRef<Promise<LocalAudioTrack> | null>(null);
  const livekitConnectRef = useRef<Promise<void> | null>(null);
  const voiceAudioElementsRef = useRef(
    new Map<
      string,
      {
        element: HTMLAudioElement;
        track: LocalTrack | RemoteTrack | null;
      }
    >(),
  );
  const pttDesiredRef = useRef(false);
  const pttApplyRef = useRef<Promise<void> | null>(null);

  const voiceMode = defaultVoiceModeForMember(roomState.voiceModes, user?.uid ?? '');
  const isSharingScreen = useMemo(() => {
    const room = roomRef.current;
    if (!room) return false;
    return Boolean(room.localParticipant.getTrackPublication(Track.Source.ScreenShare));
  }, [roomRevision]);

  const membersById = useMemo(
    () => new Map(members.map((entry) => [entry.uid, entry])),
    [members],
  );

  const currentPositionSeconds = useMemo(
    () => calculatePlaybackPosition(roomState.playback, clockNow),
    [clockNow, roomState.playback],
  );

  const ensureMicTrack = useCallback(() => {
    if (micTrackRef.current) {
      return Promise.resolve(micTrackRef.current);
    }

    if (!micTrackPromiseRef.current) {
      micTrackPromiseRef.current = createLocalAudioTrack(createMicrophoneOptions())
        .then((track) => {
          micTrackRef.current = track;
          return track;
        })
        .catch((error) => {
          micTrackPromiseRef.current = null;
          throw error;
        });
    }

    return micTrackPromiseRef.current;
  }, []);

  const resetVoiceAudioOutputs = useCallback(() => {
    voiceAudioElementsRef.current.forEach(({ element, track }) => {
      track?.detach(element);
      element.pause();
      element.removeAttribute('src');
      element.load();
      element.remove();
    });
    voiceAudioElementsRef.current.clear();
  }, []);

  const resumeRoomAudioPlayback = useCallback(async () => {
    const room = roomRef.current;
    if (!room || typeof room.startAudio !== 'function') {
      return;
    }

    try {
      await room.startAudio();
    } catch {
      // Ignore autoplay-policy failures until the next user gesture.
    }
  }, []);

  const bumpRoomRevision = useCallback(() => {
    setRoomRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToTimepassDucking(setDucking);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!roomState.playback.isPlaying) return;

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 400);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomState.playback.isPlaying]);

  useEffect(() => {
    setClockNow(Date.now());
  }, [roomState.playback]);

  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);

  const mutateRoomState = useCallback(
    async (updater: (state: TimepassRoomState) => TimepassRoomState) => {
      if (!workspaceId || !realtimeDb || !isRealtimeConfigured) {
        throw new Error('Realtime Database is required for Timepass.');
      }

      await runTransaction(ref(realtimeDb, `timepass/${workspaceId}`), (current) => {
        const nextState = updater(normalizeTimepassRoomState(current, workspaceId));
        return stripUndefinedDeep({
          ...nextState,
          queue: ensureQueueOrder(nextState.queue),
        });
      });
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!workspaceId || !realtimeDb || !isRealtimeConfigured) {
      setActionError('Timepass needs Firebase Realtime Database to be enabled.');
      return;
    }

    const currentWorkspaceId = workspaceId;
    const currentRealtimeDb = realtimeDb;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function connectRoomState() {
      try {
        if (user && member) {
          await update(ref(currentRealtimeDb, `workspaces/${currentWorkspaceId}/members/${user.uid}`), {
            uid: user.uid,
            name: member.name,
            email: member.email,
            role: member.role,
            status: member.status ?? 'active',
          });
        }

        if (cancelled) {
          return;
        }

        const roomDbRef = ref(currentRealtimeDb, `timepass/${currentWorkspaceId}`);
        await runTransaction(
          roomDbRef,
          (current) => current ?? createDefaultTimepassRoomState(currentWorkspaceId),
        );

        if (cancelled) {
          return;
        }

        setActionError(null);
        unsubscribe = onValue(
          roomDbRef,
          (snapshot) => {
            setRoomState(normalizeTimepassRoomState(snapshot.val(), currentWorkspaceId));
          },
          (error) => {
            setActionError(toErrorMessage(error, 'Unable to load Timepass room state.'));
          },
        );
      } catch (error) {
        if (!cancelled) {
          setActionError(
            toErrorMessage(error, 'Unable to prepare your Timepass room access.'),
          );
        }
      }
    }

    void connectRoomState();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [member, user, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    const mediaQuery = query(
      collection(db, 'workspaces', workspaceId, 'timepassMedia'),
      orderBy('createdAt', 'desc'),
    );

    return onSnapshot(
      mediaQuery,
      (snapshot) => {
        setUploads(
          snapshot.docs.map(
            (entry) => ({ id: entry.id, ...entry.data() }) as TimepassMediaItem,
          ),
        );
      },
      (error) => {
        setActionError(toErrorMessage(error, 'Unable to load Timepass uploads.'));
      },
    );
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !user || !member || !resolvedLivekitUrl) {
      setLiveState('disabled');
      setLiveError(livekitConfigError);
      return;
    }

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        audioPreset: AudioPresets.musicHighQualityStereo,
        dtx: false,
        red: false,
      },
    });

    roomRef.current = room;

    room
      .on(RoomEvent.ParticipantConnected, bumpRoomRevision)
      .on(RoomEvent.ParticipantDisconnected, bumpRoomRevision)
      .on(RoomEvent.TrackPublished, bumpRoomRevision)
      .on(RoomEvent.TrackUnpublished, bumpRoomRevision)
      .on(RoomEvent.TrackSubscribed, bumpRoomRevision)
      .on(RoomEvent.TrackUnsubscribed, bumpRoomRevision)
      .on(RoomEvent.ActiveSpeakersChanged, bumpRoomRevision)
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        if (cancelled) {
          return;
        }

        if (state === ConnectionState.Connected) {
          setLiveState('connected');
          setLiveError(null);
        } else if (
          state === ConnectionState.Connecting ||
          state === ConnectionState.Reconnecting ||
          state === ConnectionState.SignalReconnecting
        ) {
          setLiveState('connecting');
        } else {
          setLiveState('error');
          setLiveError('Timepass voice disconnected. Rejoin the room or refresh the page.');
          setIsMicLive(false);
          setIsPushToTalkActive(false);
          pttDesiredRef.current = false;
        }

        bumpRoomRevision();
      });

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
      resetVoiceAudioOutputs();
      micTrackRef.current?.stop();
      micTrackRef.current = null;
      micTrackPromiseRef.current = null;
      pttDesiredRef.current = false;
      setIsMicLive(false);
      setIsPushToTalkActive(false);
    };
  }, [
    bumpRoomRevision,
    livekitConfigError,
    member,
    resetVoiceAudioOutputs,
    resolvedLivekitUrl,
    user,
    workspaceId,
  ]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || typeof document === 'undefined') {
      return;
    }

    const connectedTrackIds = new Set<string>();

    Array.from(room.remoteParticipants.values()).forEach((participant) => {
      const microphoneTrack =
        participant.getTrackPublication(Track.Source.Microphone)?.track ?? null;

      if (!microphoneTrack) {
        return;
      }

      connectedTrackIds.add(participant.identity);

      let output = voiceAudioElementsRef.current.get(participant.identity);
      if (!output) {
        const element = document.createElement('audio');
        element.autoplay = true;
        element.setAttribute('playsinline', 'true');
        element.dataset.timepassVoiceParticipant = participant.identity;
        element.style.display = 'none';
        document.body.appendChild(element);

        output = {
          element,
          track: null,
        };
        voiceAudioElementsRef.current.set(participant.identity, output);
      }

      if (output.track !== microphoneTrack) {
        output.track?.detach(output.element);
        microphoneTrack.attach(output.element);
        output.track = microphoneTrack;
      }

      output.element.muted = false;
      output.element.volume = 1;
      output.element.playbackRate = 1;
      void output.element.play().catch(() => undefined);
    });

    voiceAudioElementsRef.current.forEach((output, participantId) => {
      if (connectedTrackIds.has(participantId)) {
        return;
      }

      output.track?.detach(output.element);
      output.element.pause();
      output.element.remove();
      voiceAudioElementsRef.current.delete(participantId);
    });
  }, [roomRevision]);

  const connectLiveKitRoom = useCallback(async () => {
    if (!workspaceId || !user || !member || !resolvedLivekitUrl) {
      throw new Error(
        livekitConfigError ??
          'Set VITE_LIVEKIT_WS_URL and sign in before joining Timepass voice.',
      );
    }

    const room = roomRef.current;
    if (!room) {
      throw new Error('Timepass room is not ready yet.');
    }

    if (room.state === ConnectionState.Connected) {
      return;
    }

    await resumeRoomAudioPlayback();

    if (livekitConnectRef.current) {
      await livekitConnectRef.current;
      return;
    }

    const pendingConnection = (async () => {
      setLiveState('connecting');
      setLiveError(null);

      const idToken = await user.getIdToken();
      const tokenResponse = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          workspaceId,
          memberId: user.uid,
          memberName: member.name,
          memberRole: member.role,
          memberStatus: member.status ?? 'active',
        }),
      });

      const rawPayload = await tokenResponse.text();
      let payload: {
        error?: string;
        token?: string;
        wsUrl?: string;
      } = {};

      if (rawPayload) {
        try {
          payload = JSON.parse(rawPayload) as typeof payload;
        } catch {
          payload = { error: rawPayload };
        }
      }

      if (!tokenResponse.ok || !payload.token || !payload.wsUrl) {
        throw new Error(payload.error ?? 'Unable to join the Timepass live room.');
      }

      await room.connect(payload.wsUrl, payload.token, {
        autoSubscribe: true,
      });
      await resumeRoomAudioPlayback();

      setLiveState('connected');
      setLiveError(null);
      bumpRoomRevision();
    })().catch((error) => {
      setLiveState('error');
      setLiveError(toErrorMessage(error, 'Unable to connect to Timepass voice.'));
      throw error;
    });

    livekitConnectRef.current = pendingConnection;

    try {
      await pendingConnection;
    } finally {
      if (livekitConnectRef.current === pendingConnection) {
        livekitConnectRef.current = null;
      }
    }
  }, [
    bumpRoomRevision,
    livekitConfigError,
    member,
    resolvedLivekitUrl,
    resumeRoomAudioPlayback,
    user,
    workspaceId,
  ]);

  const syncLocalPresenterRecord = useCallback(
    async (sharing: boolean, withAudio: boolean) => {
      if (!workspaceId || !user || !member) return;

      const presenterId = `presenter_${user.uid}`;
      await mutateRoomState((current) => {
        const updatedAt = nowIso();
        const presenters = sharing
          ? upsertPresenter(current.presenters, {
              id: presenterId,
              participantId: user.uid,
              memberId: user.uid,
              memberName: member.name,
              startedAt: updatedAt,
              presentationLabel: `${member.name.split(' ')[0] ?? member.name}'s share`,
              withAudio,
            })
          : removePresenter(current.presenters, presenterId);

        const shouldPinPresenter =
          sharing &&
          !current.locks.stageFrozen &&
          (!current.activeMedia || current.activeMedia.kind !== 'youtube');

        return {
          ...current,
          presenters,
          pinnedStage: shouldPinPresenter
            ? {
                kind: 'presenter',
                presenterId,
                updatedAt,
              }
            : current.pinnedStage?.presenterId === presenterId && !sharing
              ? current.activeMedia
                ? {
                    kind: 'media',
                    mediaId: current.activeMedia.id,
                    updatedAt,
                  }
                : null
              : current.pinnedStage,
          updatedAt,
        };
      });
    },
    [member, mutateRoomState, user, workspaceId],
  );

  useEffect(() => {
    const room = roomRef.current;
    if (!room || !user) return;

    const sharing = Boolean(room.localParticipant.getTrackPublication(Track.Source.ScreenShare));
    const withAudio = Boolean(
      room.localParticipant.getTrackPublication(Track.Source.ScreenShareAudio),
    );

    if (
      presenterSyncRef.current.sharing === sharing &&
      presenterSyncRef.current.withAudio === withAudio
    ) {
      return;
    }

    presenterSyncRef.current = { sharing, withAudio };
    void syncLocalPresenterRecord(sharing, withAudio);
  }, [roomRevision, syncLocalPresenterRecord, user]);

  const updateMicState = useCallback(
    async (enabled: boolean) => {
      const room = roomRef.current;
      if (!room) {
        throw new Error('Live voice is not connected yet.');
      }

      if (enabled) {
        void ensureMicTrack();
      }

      if (room.state !== ConnectionState.Connected) {
        await connectLiveKitRoom();
      }

      if (micMutationRef.current) {
        await micMutationRef.current;
      }

      const mutation = (async () => {
        if (enabled) {
          const track = await ensureMicTrack();
          const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);

          if (publication?.track) {
            await publication.unmute();
          } else {
            await room.localParticipant.publishTrack(track, {
              audioPreset: AudioPresets.musicHighQualityStereo,
              dtx: false,
              red: false,
            });
          }
        } else {
          const publication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
          if (publication?.track) {
            await publication.mute();
          }
        }

        setIsMicLive(room.localParticipant.isMicrophoneEnabled);
        setRoomRevision((value) => value + 1);
      })();

      const pendingMutation = mutation.then(() => undefined, () => undefined);
      micMutationRef.current = pendingMutation;

      try {
        await mutation;
      } finally {
        if (micMutationRef.current === pendingMutation) {
          micMutationRef.current = null;
        }
      }
    },
    [connectLiveKitRoom, ensureMicTrack],
  );

  const applyDesiredPushToTalkState = useCallback(async () => {
    if (pttApplyRef.current) {
      await pttApplyRef.current;
      return;
    }

    const applyLoop = (async () => {
      while (true) {
        const desired = pttDesiredRef.current;
        await updateMicState(desired);

        if (desired === pttDesiredRef.current) {
          break;
        }
      }
    })();

    const pendingLoop = applyLoop.then(() => undefined, () => undefined);
    pttApplyRef.current = pendingLoop;

    try {
      await applyLoop;
    } finally {
      if (pttApplyRef.current === pendingLoop) {
        pttApplyRef.current = null;
      }
    }
  }, [updateMicState]);

  const requestPushToTalkState = useCallback(
    async (pressed: boolean) => {
      void primeTimepassAudio();
      await resumeRoomAudioPlayback();
      pttDesiredRef.current = pressed;
      setIsPushToTalkActive(pressed);
      await applyDesiredPushToTalkState();
    },
    [applyDesiredPushToTalkState, resumeRoomAudioPlayback],
  );

  useEffect(() => {
    if (voiceMode !== 'push_to_talk') return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.code !== 'Space' || isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      void requestPushToTalkState(true).catch((error) => {
        setActionError(toErrorMessage(error, 'Unable to start push-to-talk.'));
      });
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space' || isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      void requestPushToTalkState(false).catch((error) => {
        setActionError(toErrorMessage(error, 'Unable to stop push-to-talk.'));
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [requestPushToTalkState, voiceMode]);

  useEffect(() => {
    if (voiceMode === 'push_to_talk') {
      return;
    }

    if (!isPushToTalkActive && !pttDesiredRef.current) {
      return;
    }

    void requestPushToTalkState(false).catch((error) => {
      setActionError(toErrorMessage(error, 'Unable to stop push-to-talk.'));
    });
  }, [isPushToTalkActive, requestPushToTalkState, voiceMode]);

  useEffect(() => {
    if (!roomState.stopAllSharesAt || roomState.stopAllSharesAt === lastStopSharesHandledRef.current) {
      return;
    }

    lastStopSharesHandledRef.current = roomState.stopAllSharesAt;
    const room = roomRef.current;
    if (!room) return;

    if (room.localParticipant.getTrackPublication(Track.Source.ScreenShare)) {
      void room.localParticipant
        .setScreenShareEnabled(false)
        .catch((error) => setActionError(toErrorMessage(error, 'Unable to stop screen share.')));
    }
  }, [roomState.stopAllSharesAt]);

  useEffect(() => {
    if (!roomState.lastResetAt || roomState.lastResetAt === lastResetHandledRef.current) {
      return;
    }

    lastResetHandledRef.current = roomState.lastResetAt;
    setActionError(null);
    const room = roomRef.current;
    if (!room) return;

    if (room.localParticipant.getTrackPublication(Track.Source.ScreenShare)) {
      void room.localParticipant.setScreenShareEnabled(false).catch(() => undefined);
    }
  }, [roomState.lastResetAt]);

  const participants = useMemo(() => {
    const room = roomRef.current;
    if (!room) return [];

    const participantEntries: Participant[] = [
      room.localParticipant,
      ...Array.from(room.remoteParticipants.values()),
    ];

    return participantEntries
      .map((participant) => {
        const memberRecord = membersById.get(participant.identity) ?? null;
        return {
          id: participant.identity,
          name: memberRecord?.name ?? participant.name ?? participant.identity,
          member: memberRecord,
          isLocal: participant.identity === user?.uid,
          isSpeaking:
            participant.identity === user?.uid
              ? isPushToTalkActive || isMicLive
              : participant.isSpeaking,
          isPresenting: roomState.presenters.some(
            (entry) => entry.participantId === participant.identity,
          ),
          voiceMode: defaultVoiceModeForMember(roomState.voiceModes, participant.identity),
        } satisfies TimepassParticipantSummary;
      })
      .sort((left, right) => {
        if (left.isLocal) return -1;
        if (right.isLocal) return 1;
        if (left.isPresenting !== right.isPresenting) return left.isPresenting ? -1 : 1;
        return left.name.localeCompare(right.name);
      });
  }, [
    isMicLive,
    isPushToTalkActive,
    membersById,
    roomRevision,
    roomState.presenters,
    roomState.voiceModes,
    user?.uid,
  ]);

  const presenters = useMemo(() => {
    const room = roomRef.current;
    if (!room) return [];

    return roomState.presenters
      .map((presenter) => {
        const participant = resolveParticipantByIdentity(room, presenter.participantId);
        const videoTrack = participant?.getTrackPublication(Track.Source.ScreenShare)?.track ?? null;
        const audioTrack =
          participant?.getTrackPublication(Track.Source.ScreenShareAudio)?.track ?? null;

        return {
          ...presenter,
          isLocal: presenter.participantId === user?.uid,
          member: membersById.get(presenter.memberId) ?? null,
          videoTrack,
          audioTrack,
        } satisfies TimepassPresenterTrack;
      })
      .filter((presenter) => presenter.videoTrack);
  }, [membersById, roomRevision, roomState.presenters, user?.uid]);

  const addUploadToQueue = useCallback(
    async (media: TimepassMediaItem) => {
      if (roomState.locks.queueFrozen && !emergencyOverride) {
        throw new Error('Queue edits are locked right now.');
      }

      await mutateRoomState((current) => {
        const queueItem = createQueueItem({
          media,
          addedBy: user?.uid ?? 'unknown',
          existingQueue: current.queue,
        });
        const updatedAt = nowIso();
        return {
          ...current,
          queue: [...current.queue, queueItem],
          updatedAt,
        };
      });
    },
    [emergencyOverride, mutateRoomState, roomState.locks.queueFrozen, user?.uid],
  );

  const addYouTubeToQueue = useCallback(
    async (url: string, title?: string) => {
      if (roomState.locks.queueFrozen && !emergencyOverride) {
        throw new Error('Queue edits are locked right now.');
      }

      const media = buildYouTubeMediaItem({
        url,
        title,
        actorId: user?.uid ?? 'unknown',
      });
      await addUploadToQueue(media);
    },
    [addUploadToQueue, emergencyOverride, roomState.locks.queueFrozen, user?.uid],
  );

  const uploadMedia = useCallback(
    async (file: File) => {
      if (!workspaceId || !user) {
        throw new Error('Workspace unavailable.');
      }

      if (file.size > TIMEPASS_MAX_UPLOAD_BYTES) {
        throw new Error('Upload files must stay under 200 MB.');
      }

      if (
        !TIMEPASS_SUPPORTED_AUDIO_TYPES.includes(file.type) &&
        !/\.(mp3|m4a|aac|wav|flac)$/i.test(file.name)
      ) {
        throw new Error('Supported formats are mp3, m4a, aac, wav, and flac.');
      }

      const mediaId = generateToken('timepass_media');
      const storagePath = `workspaces/${workspaceId}/timepass/${user.uid}/${mediaId}_${file.name}`;
      const storageReference = storageRef(storage, storagePath);
      await uploadBytes(storageReference, file, {
        contentType: file.type || 'audio/mpeg',
      });
      const url = await getDownloadURL(storageReference);
      const createdAt = nowIso();

      await setDoc(doc(db, 'workspaces', workspaceId, 'timepassMedia', mediaId), {
        kind: 'upload',
        title: file.name.replace(/\.[^.]+$/, ''),
        createdBy: user.uid,
        createdAt,
        updatedAt: createdAt,
        url,
        storagePath,
        contentType: file.type || 'audio/mpeg',
        sizeBytes: file.size,
        accent: '#68d391',
      } satisfies Omit<TimepassMediaItem, 'id'>);
    },
    [user, workspaceId],
  );

  const deleteMedia = useCallback(
    async (media: TimepassMediaItem) => {
      if (!workspaceId || !user) {
        throw new Error('Workspace unavailable.');
      }

      const isOwner = media.createdBy === user.uid;
      if (!isOwner && !emergencyOverride) {
        throw new Error('Only founders/managers can remove someone else’s upload.');
      }

      await deleteDoc(doc(db, 'workspaces', workspaceId, 'timepassMedia', media.id));
      if (media.storagePath) {
        await deleteObject(storageRef(storage, media.storagePath)).catch(() => undefined);
      }
    },
    [emergencyOverride, user, workspaceId],
  );

  const playQueueItem = useCallback(
    async (itemId: string) => {
      await mutateRoomState((current) => {
        const target = current.queue.find((entry) => entry.id === itemId);
        if (!target) return current;

        const updatedAt = nowIso();
        return {
          ...current,
          activeMedia: target.media,
          playback: {
            isPlaying: true,
            positionSeconds: 0,
            playbackRate: 1,
            updatedAt,
            updatedBy: user?.uid,
          },
          pinnedStage: current.locks.stageFrozen
            ? current.pinnedStage
            : {
                kind: 'media',
                mediaId: target.media.id,
                updatedAt,
              },
          updatedAt,
        };
      });
    },
    [mutateRoomState, user?.uid],
  );

  const togglePlayback = useCallback(async () => {
    await mutateRoomState((current) => {
      if (!current.activeMedia) return current;
      const now = Date.now();
      const updatedAt = new Date(now).toISOString();
      return {
        ...current,
        playback: {
          ...current.playback,
          isPlaying: !current.playback.isPlaying,
          positionSeconds: calculatePlaybackPosition(current.playback, now),
          updatedAt,
          updatedBy: user?.uid,
        },
        updatedAt,
      };
    });
  }, [mutateRoomState, user?.uid]);

  const seekPlayback = useCallback(
    async (seconds: number) => {
      await mutateRoomState((current) => ({
        ...current,
        playback: {
          ...current.playback,
          positionSeconds: Math.max(0, seconds),
          updatedAt: nowIso(),
          updatedBy: user?.uid,
        },
        updatedAt: nowIso(),
      }));
    },
    [mutateRoomState, user?.uid],
  );

  const skipToNext = useCallback(async () => {
    await mutateRoomState((current) => {
      const nextItem = getNextQueueItem(current);
      const updatedAt = nowIso();

      if (!nextItem) {
        return {
          ...current,
          activeMedia: null,
          playback: {
            ...current.playback,
            isPlaying: false,
            positionSeconds: 0,
            updatedAt,
            updatedBy: user?.uid,
          },
          updatedAt,
        };
      }

      return {
        ...current,
        activeMedia: nextItem.media,
        playback: {
          isPlaying: true,
          positionSeconds: 0,
          playbackRate: 1,
          updatedAt,
          updatedBy: user?.uid,
        },
        pinnedStage: current.locks.stageFrozen
          ? current.pinnedStage
          : {
              kind: 'media',
              mediaId: nextItem.media.id,
              updatedAt,
            },
        updatedAt,
      };
    });
  }, [mutateRoomState, user?.uid]);

  const advanceQueueFromMedia = useCallback(
    async (mediaId: string) => {
      if (roomState.activeMedia?.id !== mediaId) return;
      await skipToNext();
    },
    [roomState.activeMedia?.id, skipToNext],
  );

  const removeQueueItemAction = useCallback(
    async (itemId: string) => {
      if (roomState.locks.queueFrozen && !emergencyOverride) {
        throw new Error('Queue edits are locked right now.');
      }

      await mutateRoomState((current) => {
        const removedItem = current.queue.find((entry) => entry.id === itemId);
        const nextQueue = removeQueueItem(current.queue, itemId);
        const updatedAt = nowIso();

        return {
          ...current,
          queue: nextQueue,
          activeMedia:
            removedItem?.mediaId === current.activeMedia?.id
              ? nextQueue[0]?.media ?? null
              : current.activeMedia,
          playback:
            removedItem?.mediaId === current.activeMedia?.id && nextQueue[0]
              ? {
                  isPlaying: true,
                  positionSeconds: 0,
                  playbackRate: 1,
                  updatedAt,
                  updatedBy: user?.uid,
                }
              : current.playback,
          updatedAt,
        };
      });
    },
    [emergencyOverride, mutateRoomState, roomState.locks.queueFrozen, user?.uid],
  );

  const moveQueueItemAction = useCallback(
    async (itemId: string, targetIndex: number) => {
      if (roomState.locks.queueFrozen && !emergencyOverride) {
        throw new Error('Queue edits are locked right now.');
      }

      await mutateRoomState((current) => ({
        ...current,
        queue: moveQueueItem(current.queue, itemId, targetIndex),
        updatedAt: nowIso(),
      }));
    },
    [emergencyOverride, mutateRoomState, roomState.locks.queueFrozen],
  );

  const pinPresenter = useCallback(
    async (presenterId: string) => {
      if (roomState.locks.stageFrozen && !emergencyOverride) {
        throw new Error('Stage changes are locked right now.');
      }

      await mutateRoomState((current) => ({
        ...current,
        pinnedStage: {
          kind: 'presenter',
          presenterId,
          updatedAt: nowIso(),
        },
        updatedAt: nowIso(),
      }));
    },
    [emergencyOverride, mutateRoomState, roomState.locks.stageFrozen],
  );

  const pinMedia = useCallback(
    async (mediaId: string) => {
      if (roomState.locks.stageFrozen && !emergencyOverride) {
        throw new Error('Stage changes are locked right now.');
      }

      await mutateRoomState((current) => ({
        ...current,
        pinnedStage: {
          kind: 'media',
          mediaId,
          updatedAt: nowIso(),
        },
        updatedAt: nowIso(),
      }));
    },
    [emergencyOverride, mutateRoomState, roomState.locks.stageFrozen],
  );

  const clearPinnedStage = useCallback(async () => {
    if (roomState.locks.stageFrozen && !emergencyOverride) {
      throw new Error('Stage changes are locked right now.');
    }

    await mutateRoomState((current) => ({
      ...current,
      pinnedStage: null,
      updatedAt: nowIso(),
    }));
  }, [emergencyOverride, mutateRoomState, roomState.locks.stageFrozen]);

  const emitReaction = useCallback(
    async (kind: TimepassReactionKind) => {
      void primeTimepassAudio();
      if (roomState.locks.soundboardMuted && !emergencyOverride) {
        throw new Error('Soundboard reactions are muted by leadership.');
      }

      const now = Date.now();
      if (now - reactionThrottleRef.current < 650) {
        return;
      }

      reactionThrottleRef.current = now;
      const createdAt = new Date(now).toISOString();
      await mutateRoomState((current) => ({
        ...current,
        reactions: [
          ...current.reactions,
          {
            id: generateToken('timepass_reaction'),
            kind,
            actorId: user?.uid ?? 'unknown',
            actorName: member?.name ?? 'Teammate',
            createdAt,
          },
        ].slice(-12),
        updatedAt: createdAt,
      }));
    },
    [
      emergencyOverride,
      member?.name,
      mutateRoomState,
      roomState.locks.soundboardMuted,
      user?.uid,
    ],
  );

  const setVoiceMode = useCallback(
    async (mode: TimepassVoiceMode) => {
      if (!user) return;
      await mutateRoomState((current) => ({
        ...current,
        voiceModes: {
          ...current.voiceModes,
          [user.uid]: mode,
        },
        updatedAt: nowIso(),
      }));
    },
    [mutateRoomState, user],
  );

  const beginPushToTalk = useCallback(async () => {
    await requestPushToTalkState(true);
  }, [requestPushToTalkState]);

  const endPushToTalk = useCallback(async () => {
    await requestPushToTalkState(false);
  }, [requestPushToTalkState]);

  const toggleOpenMic = useCallback(async () => {
    void primeTimepassAudio();
    await resumeRoomAudioPlayback();
    await updateMicState(!isMicLive);
  }, [isMicLive, resumeRoomAudioPlayback, updateMicState]);

  const toggleScreenShare = useCallback(async () => {
    void primeTimepassAudio();
    await resumeRoomAudioPlayback();
    const room = roomRef.current;
    if (!room) {
      throw new Error('Connect to the live lounge before sharing your screen.');
    }

    if (room.state !== ConnectionState.Connected) {
      await connectLiveKitRoom();
    }

    const isStartingShare = !room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const publishOptions = {
      screenShareEncoding: {
        maxBitrate: 3_500_000,
        maxFramerate: 30,
      },
      audioPreset: AudioPresets.musicHighQualityStereo,
      dtx: false,
      red: false,
    };

    if (!isStartingShare) {
      await room.localParticipant.setScreenShareEnabled(false);
      setRoomRevision((value) => value + 1);
      return;
    }

    try {
      await room.localParticipant.setScreenShareEnabled(
        true,
        createScreenShareOptions(),
        publishOptions,
      );
    } catch (error) {
      const message = toErrorMessage(error, 'Unable to start screen sharing.');
      const mayNeedVideoOnlyFallback =
        message.toLowerCase().includes('audio') ||
        message.toLowerCase().includes('system') ||
        message.toLowerCase().includes('not supported');

      if (!mayNeedVideoOnlyFallback) {
        throw error;
      }

      await room.localParticipant.setScreenShareEnabled(
        true,
        {
          ...createScreenShareOptions(),
          audio: false,
        },
        publishOptions,
      );
    }

    setRoomRevision((value) => value + 1);
  }, [connectLiveKitRoom, resumeRoomAudioPlayback]);

  const updateLock = useCallback(
    async (key: 'queueFrozen' | 'stageFrozen' | 'soundboardMuted', value: boolean) => {
      if (!emergencyOverride) {
        throw new Error('Only founders and managers can use emergency controls.');
      }

      await mutateRoomState((current) => ({
        ...current,
        locks: {
          ...current.locks,
          [key]: value,
        },
        updatedAt: nowIso(),
      }));
    },
    [emergencyOverride, mutateRoomState],
  );

  const stopAllShares = useCallback(async () => {
    if (!emergencyOverride) {
      throw new Error('Only founders and managers can stop all shares.');
    }

    await mutateRoomState((current) => ({
      ...current,
      presenters: [],
      pinnedStage: current.activeMedia
        ? {
            kind: 'media',
            mediaId: current.activeMedia.id,
            updatedAt: nowIso(),
          }
        : null,
      stopAllSharesAt: nowIso(),
      updatedAt: nowIso(),
    }));
  }, [emergencyOverride, mutateRoomState]);

  const resetRoom = useCallback(async () => {
    if (!emergencyOverride || !workspaceId) {
      throw new Error('Only founders and managers can reset the room.');
    }

    void primeTimepassAudio();
    await mutateRoomState((current) => {
      const resetAt = nowIso();
      return {
        ...createDefaultTimepassRoomState(workspaceId, resetAt),
        voiceModes: current.voiceModes,
        lastResetAt: resetAt,
        stopAllSharesAt: resetAt,
      };
    });
  }, [emergencyOverride, mutateRoomState, workspaceId]);

  const safeAction = useCallback(
    async (action: () => Promise<void>) => {
      try {
        setActionError(null);
        await action();
      } catch (error) {
        setActionError(toErrorMessage(error, 'Timepass action failed.'));
        throw error;
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
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
      addYouTubeToQueue: (url: string, title?: string) =>
        safeAction(() => addYouTubeToQueue(url, title)),
      addUploadToQueue: (media: TimepassMediaItem) => safeAction(() => addUploadToQueue(media)),
      uploadMedia: (file: File) => safeAction(() => uploadMedia(file)),
      deleteMedia: (media: TimepassMediaItem) => safeAction(() => deleteMedia(media)),
      playQueueItem: (itemId: string) => safeAction(() => playQueueItem(itemId)),
      togglePlayback: () => safeAction(togglePlayback),
      seekPlayback: (seconds: number) => safeAction(() => seekPlayback(seconds)),
      skipToNext: () => safeAction(skipToNext),
      advanceQueueFromMedia: (mediaId: string) =>
        safeAction(() => advanceQueueFromMedia(mediaId)),
      removeQueueItem: (itemId: string) => safeAction(() => removeQueueItemAction(itemId)),
      moveQueueItem: (itemId: string, targetIndex: number) =>
        safeAction(() => moveQueueItemAction(itemId, targetIndex)),
      pinPresenter: (presenterId: string) => safeAction(() => pinPresenter(presenterId)),
      pinMedia: (mediaId: string) => safeAction(() => pinMedia(mediaId)),
      clearPinnedStage: () => safeAction(clearPinnedStage),
      emitReaction: (kind: TimepassReactionKind) => safeAction(() => emitReaction(kind)),
      setVoiceMode: (mode: TimepassVoiceMode) => safeAction(() => setVoiceMode(mode)),
      beginPushToTalk: () => safeAction(beginPushToTalk),
      endPushToTalk: () => safeAction(endPushToTalk),
      toggleOpenMic: () => safeAction(toggleOpenMic),
      toggleScreenShare: () => safeAction(toggleScreenShare),
      setQueueFrozen: (value: boolean) => safeAction(() => updateLock('queueFrozen', value)),
      setStageFrozen: (value: boolean) => safeAction(() => updateLock('stageFrozen', value)),
      setSoundboardMuted: (value: boolean) =>
        safeAction(() => updateLock('soundboardMuted', value)),
      stopAllShares: () => safeAction(stopAllShares),
      resetRoom: () => safeAction(resetRoom),
      clearActionError,
    } satisfies TimepassContextValue),
    [
      actionError,
      addUploadToQueue,
      addYouTubeToQueue,
      advanceQueueFromMedia,
      beginPushToTalk,
      clearActionError,
      clearPinnedStage,
      currentPositionSeconds,
      deleteMedia,
      ducking,
      emergencyOverride,
      emitReaction,
      endPushToTalk,
      isMicLive,
      isPushToTalkActive,
      isSharingScreen,
      liveError,
      liveState,
      moveQueueItemAction,
      participants,
      pinMedia,
      pinPresenter,
      playQueueItem,
      presenters,
      removeQueueItemAction,
      resetRoom,
      roomState,
      safeAction,
      seekPlayback,
      setVoiceMode,
      skipToNext,
      stopAllShares,
      toggleOpenMic,
      togglePlayback,
      toggleScreenShare,
      updateLock,
      uploadMedia,
      uploads,
      voiceMode,
    ],
  );

  return <TimepassContext.Provider value={value}>{children}</TimepassContext.Provider>;
}
