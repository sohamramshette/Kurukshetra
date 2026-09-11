import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from './cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  elevated?: boolean
}

export function Card({ children, className, elevated = false, ...props }: CardProps) {
  return (
    <div className={cn('ui-card', elevated && 'ui-card--elevated', className)} {...props}>
      {children}
    </div>
  )
}
