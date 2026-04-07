'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { UltraCard } from '@/components/ui/UltraCard';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <UltraCard
      interactive={false}
      className={cn('p-8 text-center sm:p-10', className)}
    >
      <div className="panel-stack-center stagger-children mx-auto max-w-xl">
        {icon && (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-border/15 bg-card/60 shadow-inner-glow">
            {icon}
          </div>
        )}
        <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">
          {title}
        </h3>
        {description && (
          <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--text-secondary))]">
            {description}
          </p>
        )}
        {action && <div className="mt-7 flex justify-center">{action}</div>}
      </div>
    </UltraCard>
  );
}
