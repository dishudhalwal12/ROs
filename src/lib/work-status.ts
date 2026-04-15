import type { LiveStatusRecord, WorkMode } from '@/types/models';

export const DEFAULT_REST_LABEL = 'Taking a break';

export interface StatusTransitionResolution {
  nextLabel: string;
  shouldFinalizeCurrent: boolean;
  shouldUpdateLabel: boolean;
}

export function getStatusDurationMinutes(startedAt: string, endedAt: string) {
  return Math.max(
    1,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000),
  );
}

export function resolveStatusTransition(
  current: LiveStatusRecord | null,
  nextMode: WorkMode,
  rawLabel: string,
): StatusTransitionResolution {
  const trimmedLabel = rawLabel.trim();

  if (nextMode === 'work' && !trimmedLabel && current?.mode !== 'work') {
    throw new Error('Add what you are working on before starting work mode.');
  }

  const nextLabel =
    trimmedLabel ||
    (nextMode === 'rest' ? DEFAULT_REST_LABEL : current?.label ?? '');

  return {
    nextLabel,
    shouldFinalizeCurrent: Boolean(current && current.mode !== nextMode),
    shouldUpdateLabel: Boolean(current && current.mode === nextMode && nextLabel !== current.label),
  };
}
