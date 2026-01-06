'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccordionType = 'single' | 'multiple';

type AccordionContextValue = {
  type: AccordionType;
  openValues: Set<string>;
  toggle: (value: string) => void;
};

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

export function Accordion({
  type = 'single',
  defaultValue,
  className,
  children,
}: {
  type?: AccordionType;
  defaultValue?: string | string[];
  className?: string;
  children: React.ReactNode;
}) {
  const [openValues, setOpenValues] = React.useState<Set<string>>(() => {
    if (!defaultValue) return new Set<string>();
    if (Array.isArray(defaultValue)) return new Set(defaultValue);
    return new Set([defaultValue]);
  });

  const toggle = React.useCallback(
    (value: string) => {
      setOpenValues(prev => {
        const next = new Set(prev);
        const isOpen = next.has(value);
        if (type === 'single') {
          next.clear();
          if (!isOpen) next.add(value);
          return next;
        }
        if (isOpen) next.delete(value);
        else next.add(value);
        return next;
      });
    },
    [type]
  );

  const ctx = React.useMemo<AccordionContextValue>(() => ({ type, openValues, toggle }), [type, openValues, toggle]);

  return (
    <AccordionContext.Provider value={ctx}>
      <div className={cn('space-y-3', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error('AccordionItem must be used within Accordion');
  const open = ctx.openValues.has(value);

  return (
    <div
      data-state={open ? 'open' : 'closed'}
      className={cn('section-container hover-lift-soft', className)}
    >
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child as any, { value, open });
      })}
    </div>
  );
}

export function AccordionTrigger({
  value,
  open,
  className,
  children,
}: {
  value?: string;
  open?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error('AccordionTrigger must be used within Accordion');

  return (
    <button
      type="button"
      className={cn('section-header press-scale focus-ring-animated text-left w-full', className)}
      onClick={() => (value ? ctx.toggle(value) : null)}
      aria-expanded={!!open}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{children}</span>
      </span>
      <ChevronDown
        className={cn(
          'w-5 h-5 text-gray-400 transition-transform duration-200',
          open && 'rotate-180'
        )}
      />
    </button>
  );
}

export function AccordionContent({
  open,
  className,
  children,
}: {
  open?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}
    >
      <div className="overflow-hidden">
        <div className={cn('section-body', open && 'collapse-expand', className)}>{children}</div>
      </div>
    </div>
  );
}

