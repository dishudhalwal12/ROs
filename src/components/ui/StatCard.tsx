import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  tone?: 'violet' | 'peach' | 'blue' | 'gold' | 'mint';
  className?: string;
  onTitleClick?: () => void;
  titlePressed?: boolean;
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  tone = 'violet',
  className,
  onTitleClick,
  titlePressed,
}: StatCardProps) {
  return (
    <article className={cn(`stat-card stat-card--${tone}`, className)}>
      <div className="stat-card__icon">
        <Icon size={18} />
      </div>
      <div className="stat-card__meta">
        {onTitleClick ? (
          <button
            type="button"
            className="stat-card__title-button"
            onClick={onTitleClick}
            aria-pressed={titlePressed}
          >
            {title}
          </button>
        ) : (
          <span>{title}</span>
        )}
        <strong>{value}</strong>
        <small>{change}</small>
      </div>
    </article>
  );
}
