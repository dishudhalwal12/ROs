import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  tone?: 'violet' | 'peach' | 'blue' | 'gold' | 'mint';
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  tone = 'violet',
  className,
}: StatCardProps) {
  return (
    <article className={cn(`stat-card stat-card--${tone}`, className)}>
      <div className="stat-card__icon">
        <Icon size={18} />
      </div>
      <div className="stat-card__meta">
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{change}</small>
      </div>
    </article>
  );
}
