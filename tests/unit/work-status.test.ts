import type { LiveStatusRecord } from '@/types/models';
import { DEFAULT_REST_LABEL, resolveStatusTransition } from '@/lib/work-status';

const activeWork: LiveStatusRecord = {
  memberId: 'user_1',
  mode: 'work',
  label: 'Fixing the messages page',
  startedAt: '2026-04-16T08:00:00.000Z',
  updatedAt: '2026-04-16T08:00:00.000Z',
};

describe('work status transitions', () => {
  it('requires a label when starting work from idle', () => {
    expect(() => resolveStatusTransition(null, 'work', '   ')).toThrow(
      'Add what you are working on before starting work mode.',
    );
  });

  it('defaults rest mode to the shared break label', () => {
    expect(resolveStatusTransition(null, 'rest', '   ')).toEqual({
      nextLabel: DEFAULT_REST_LABEL,
      shouldFinalizeCurrent: false,
      shouldUpdateLabel: false,
    });
  });

  it('finalizes the current session when switching from work to rest', () => {
    expect(resolveStatusTransition(activeWork, 'rest', '')).toEqual({
      nextLabel: DEFAULT_REST_LABEL,
      shouldFinalizeCurrent: true,
      shouldUpdateLabel: false,
    });
  });

  it('updates the active label without finalizing when the mode stays the same', () => {
    expect(resolveStatusTransition(activeWork, 'work', 'Reviewing new sidebar UI')).toEqual({
      nextLabel: 'Reviewing new sidebar UI',
      shouldFinalizeCurrent: false,
      shouldUpdateLabel: true,
    });
  });
});
