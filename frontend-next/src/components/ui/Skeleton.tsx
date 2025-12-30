'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cn('skeleton', className)} {...props} />;
});
Skeleton.displayName = 'Skeleton';

export function SkeletonText({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn('h-3 w-full rounded', className)} {...props} />;
}

export function SkeletonCircle({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} {...props} />;
}

export function SkeletonButton({ className, ...props }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-28 rounded-xl', className)} {...props} />;
}

