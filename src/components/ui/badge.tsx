import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline'
}

export const Badge = ({
  className,
  variant = 'default',
  ...props
}: BadgeProps) => (
  <span
    {...props}
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide transition',
      variant === 'default'
        ? 'bg-slate-900/80 text-white shadow-sm'
        : 'border border-slate-200 bg-white/60 text-slate-600 shadow-sm',
      className,
    )}
  />
)

export default Badge
