import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from './cn'

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function PageContainer({ children, className, ...props }: PageContainerProps) {
  return (
    <div className={cn('page-container', className)} {...props}>
      {children}
    </div>
  )
}
