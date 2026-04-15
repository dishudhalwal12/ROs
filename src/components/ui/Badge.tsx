import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const toneClassMap = {
  neutral: 'badge badge-neutral',
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  danger: 'badge badge-danger',
  info: 'badge badge-info',
};

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return <span className={cn(toneClassMap[tone], className)}>{children}</span>;
}
