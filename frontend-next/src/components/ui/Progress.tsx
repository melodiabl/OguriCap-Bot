'use client'

import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  shimmer?: boolean
  fillClassName?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, fillClassName, shimmer = false, value = 0, max = 100, ...props }, ref) => {
    const reduceMotion = useReducedMotion()
    const ratio = Math.min(Math.max(max > 0 ? value / max : 0, 0), 1)
    
    return (
      <div
        ref={ref}
        className={cn(
          'progress-bar',
          className
        )}
        data-shimmer={shimmer ? 'true' : 'false'}
        {...props}
      >
        <motion.div
          className={cn('progress-bar-fill', fillClassName)}
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: ratio }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
