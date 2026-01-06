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
      className={cn('p-10 text-center', className)}
    >
      <div className="stagger-children">
        {icon && (
          <div className="mx-auto w-16 h-16 rounded-3xl border border-white/15 bg-white/5 shadow-inner-glow flex items-center justify-center">
            {icon}
          </div>
        )}
        <h3 className="mt-5 text-2xl font-extrabold text-white tracking-tight">
          {title}
        </h3>
        {description && (
          <p className="mt-2 text-sm text-gray-300 max-w-md mx-auto">
            {description}
          </p>
        )}
        {action && <div className="mt-7 flex justify-center">{action}</div>}
      </div>
    </UltraCard>
  );
}
