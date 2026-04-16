import { useContext } from 'react';

import { TimepassContext } from '@/features/timepass/TimepassProvider';

export function useTimepass() {
  const context = useContext(TimepassContext);
  if (!context) {
    throw new Error('useTimepass must be used inside TimepassProvider');
  }

  return context;
}
