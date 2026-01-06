'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type SectionProps = {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

export function Section({
  title,
  description,
  icon,
  actions,
  footer,
  children,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
}: SectionProps) {
  const hasHeader = Boolean(title || description || icon || actions);
  return (
    <section className={cn('section-container', className)}>
      {hasHeader && (
        <header className={cn('section-header', headerClassName)}>
          <div className="flex items-start gap-3 min-w-0">
            {icon ? <div className="shrink-0">{icon}</div> : null}
            <div className="min-w-0">
              {title ? (
                <h3 className="text-lg font-semibold text-white [html[data-theme=light]_&]:text-gray-900 truncate">
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p className="text-sm text-gray-400 [html[data-theme=light]_&]:text-gray-600 truncate">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
        </header>
      )}

      <div className={cn('section-body', bodyClassName)}>{children}</div>

      {footer ? <footer className={cn('section-footer', footerClassName)}>{footer}</footer> : null}
    </section>
  );
}
