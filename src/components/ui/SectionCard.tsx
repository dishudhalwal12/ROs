import type { PropsWithChildren, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface SectionCardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  action,
  className,
  children,
}: SectionCardProps) {
  return (
    <section className={cn('section-card', className)}>
      <header className="section-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action ? <div className="section-card__action">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
