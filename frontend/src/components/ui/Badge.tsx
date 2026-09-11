import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from './cn'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'hold'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  tone?: BadgeTone
}

export function Badge({ children, className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span className={cn('ui-badge', `ui-badge--${tone}`, className)} {...props}>
      {children}
    </span>
  )
}
