import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { GripHorizontal } from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import { useWorkspace } from '@/hooks/use-workspace';

interface TrackerLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PointerInteraction {
  type: 'drag' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  origin: TrackerLayout;
}

interface TapState {
  time: number;
  pointerType: string;
}

const TRACKER_LAYOUT_STORAGE_KEY = 'rovexa-work-rest-widget-layout';
const TRACKER_MINIMIZED_STORAGE_KEY = 'rovexa-work-rest-widget-minimized';
const MIN_WIDTH = 280;
const MIN_HEIGHT = 168;
const MARGIN = 20;
const COLLAPSED_HEIGHT = 56;

function clampLayout(layout: TrackerLayout, visibleHeight = layout.height) {
  if (typeof window === 'undefined') return layout;

  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - MARGIN * 2);
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - MARGIN * 2);
  const width = Math.min(Math.max(layout.width, MIN_WIDTH), maxWidth);
  const height = Math.min(Math.max(layout.height, MIN_HEIGHT), maxHeight);
  const maxX = Math.max(MARGIN, window.innerWidth - width - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - visibleHeight - MARGIN);

  return {
    width,
    height,
    x: Math.min(Math.max(layout.x, MARGIN), maxX),
    y: Math.min(Math.max(layout.y, MARGIN), maxY),
  };
}

function getDefaultLayout(): TrackerLayout {
  if (typeof window === 'undefined') {
    return { x: 24, y: 24, width: 320, height: 184 };
  }

  return clampLayout({
    width: 320,
    height: 184,
    x: window.innerWidth - 320 - 28,
    y: window.innerHeight - 184 - 28,
  });
}

function readStoredLayout(isMinimized: boolean) {
  if (typeof window === 'undefined') return getDefaultLayout();

  const saved = window.localStorage.getItem(TRACKER_LAYOUT_STORAGE_KEY);
  if (!saved) return getDefaultLayout();

  try {
    const parsed = JSON.parse(saved) as TrackerLayout;
    return clampLayout(parsed, isMinimized ? COLLAPSED_HEIGHT : parsed.height);
  } catch {
    return getDefaultLayout();
  }
}

function readStoredMinimizedState() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(TRACKER_MINIMIZED_STORAGE_KEY) === 'true';
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('button, input, textarea, select, option, a, label'))
  );
}

export function FloatingWorkRestWidget() {
  const { user } = useAuth();
  const { liveStatuses, switchWorkMode } = useWorkspace();
  const currentStatus = user ? liveStatuses[user.uid] ?? null : null;
  const [isMinimized, setIsMinimized] = useState(() => readStoredMinimizedState());
  const [layout, setLayout] = useState<TrackerLayout>(() => readStoredLayout(readStoredMinimizedState()));
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const layoutRef = useRef(layout);
  const lastTapRef = useRef<TapState | null>(null);
  const isMinimizedRef = useRef(isMinimized);

  const persistLayout = useCallback((nextLayout: TrackerLayout) => {
    if (typeof window === 'undefined') return;
    const visibleHeight = isMinimizedRef.current ? COLLAPSED_HEIGHT : nextLayout.height;
    window.localStorage.setItem(
      TRACKER_LAYOUT_STORAGE_KEY,
      JSON.stringify(clampLayout(nextLayout, visibleHeight)),
    );
  }, []);

  const stopInteraction = useCallback((pointerId?: number) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    if (pointerId !== undefined && interaction.pointerId !== pointerId) return;

    interactionRef.current = null;
    persistLayout(layoutRef.current);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [persistLayout]);

  function toggleMinimized() {
    stopInteraction();
    setIsMinimized((current) => {
      const next = !current;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TRACKER_MINIMIZED_STORAGE_KEY, String(next));
      }
      return next;
    });
  }

  function startInteraction(
    type: PointerInteraction['type'],
    event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>,
  ) {
    event.preventDefault();

    interactionRef.current = {
      type,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: layoutRef.current,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'drag' ? 'grabbing' : 'nwse-resize';
  }

  function handleTapToToggle(pointerType: string) {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    lastTapRef.current = { time: now, pointerType };

    if (!lastTap) return;
    if (lastTap.pointerType !== pointerType) return;
    if (now - lastTap.time > 320) return;

    lastTapRef.current = null;
    toggleMinimized();
  }

  function isQuickTap(event: ReactPointerEvent<HTMLButtonElement | HTMLDivElement>) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return false;

    const deltaX = Math.abs(event.clientX - interaction.startX);
    const deltaY = Math.abs(event.clientY - interaction.startY);
    return deltaX < 6 && deltaY < 6;
  }

  useEffect(() => {
    setDraft(currentStatus?.label ?? '');
  }, [currentStatus?.label, currentStatus?.mode]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  useEffect(() => {
    const onResize = () => {
      setLayout((current) => {
        const nextLayout = clampLayout(
          current,
          isMinimizedRef.current ? COLLAPSED_HEIGHT : current.height,
        );
        layoutRef.current = nextLayout;
        persistLayout(nextLayout);
        return nextLayout;
      });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [persistLayout]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction || event.pointerId !== interaction.pointerId) return;

      event.preventDefault();

      const deltaX = event.clientX - interaction.startX;
      const deltaY = event.clientY - interaction.startY;
      const visibleHeight = isMinimizedRef.current ? 56 : interaction.origin.height;
      const nextLayout =
        interaction.type === 'drag'
          ? clampLayout({
              ...interaction.origin,
              x: interaction.origin.x + deltaX,
              y: interaction.origin.y + deltaY,
            }, visibleHeight)
          : clampLayout({
              ...interaction.origin,
              width: interaction.origin.width + deltaX,
              height: interaction.origin.height + deltaY,
            }, visibleHeight);

      layoutRef.current = nextLayout;
      setLayout(nextLayout);
    };

    const onPointerUp = (event: PointerEvent) => {
      stopInteraction(event.pointerId);
    };

    const onPointerCancel = (event: PointerEvent) => {
      stopInteraction(event.pointerId);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [stopInteraction]);

  async function handleModeClick(mode: 'work' | 'rest') {
    setPending(true);
    setError(null);

    try {
      await switchWorkMode({ mode, label: draft });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Unable to update work mode.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={isMinimized ? 'floating-tracker floating-tracker--collapsed' : 'floating-tracker'}
      onPointerDown={(event) => {
        if (isInteractiveTarget(event.target)) return;
        startInteraction('drag', event);
      }}
      style={{
        left: `${layout.x}px`,
        top: `${layout.y}px`,
        width: `${layout.width}px`,
        height: `${isMinimized ? COLLAPSED_HEIGHT : layout.height}px`,
      }}
    >
      <button
        type="button"
        className={
          isMinimized
            ? 'floating-tracker__drag-handle floating-tracker__drag-handle--collapsed'
            : 'floating-tracker__drag-handle'
        }
        onPointerDown={(event) => startInteraction('drag', event)}
        onPointerUp={(event) => {
          if (event.pointerType !== 'mouse' && event.pointerType !== 'touch') return;
          if (!isQuickTap(event)) return;
          handleTapToToggle(event.pointerType);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          toggleMinimized();
        }}
        aria-label="Drag or double-tap to minimize work tracker"
        aria-expanded={!isMinimized}
      >
        <GripHorizontal size={16} />
        <span>{currentStatus ? `Now ${currentStatus.mode}` : 'Set your status'}</span>
      </button>

      <div className={isMinimized ? 'floating-tracker__content floating-tracker__content--collapsed' : 'floating-tracker__content'}>
        <label className="floating-tracker__field">
          <span>{currentStatus?.mode === 'rest' ? 'Rest note' : 'Working on'}</span>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What are you doing right now?"
          />
        </label>

        <div className="floating-tracker__buttons">
          <button
            type="button"
            className={
              currentStatus?.mode === 'work'
                ? 'tracker-key tracker-key--active'
                : 'tracker-key'
            }
            disabled={pending}
            onClick={() => void handleModeClick('work')}
          >
            Work
          </button>
          <button
            type="button"
            className={
              currentStatus?.mode === 'rest'
                ? 'tracker-key tracker-key--active tracker-key--rest'
                : 'tracker-key tracker-key--rest'
            }
            disabled={pending}
            onClick={() => void handleModeClick('rest')}
          >
            Rest
          </button>
        </div>

        <p className="floating-tracker__status">
          {currentStatus
            ? `${currentStatus.mode === 'work' ? 'Working' : 'Resting'}: ${currentStatus.label}`
            : 'No live status yet. Start work or rest whenever you’re ready.'}
        </p>

        {error ? <div className="form-error">{error}</div> : null}
      </div>

      <button
        type="button"
        className={
          isMinimized
            ? 'floating-tracker__resize-handle floating-tracker__resize-handle--hidden'
            : 'floating-tracker__resize-handle'
        }
        onPointerDown={(event) => startInteraction('resize', event)}
        aria-label="Resize work tracker"
      />
    </div>
  );
}
