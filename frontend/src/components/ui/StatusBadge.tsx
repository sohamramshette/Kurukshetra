import { Badge, type BadgeProps } from './Badge'

export type Status = 'protected' | 'secure' | 'pending' | 'warning' | 'hold' | 'danger'

export interface StatusBadgeProps extends Omit<BadgeProps, 'children' | 'tone'> {
  status: Status
  label?: string
}

const statusLabels: Record<Status, string> = {
  protected: 'Protected',
  secure: 'Secure',
  pending: 'Pending',
  warning: 'Review needed',
  hold: 'On hold',
  danger: 'Blocked',
}

const statusTones: Record<Status, NonNullable<BadgeProps['tone']>> = {
  protected: 'success',
  secure: 'success',
  pending: 'accent',
  warning: 'warning',
  hold: 'hold',
  danger: 'danger',
}

export function StatusBadge({ label, status, ...props }: StatusBadgeProps) {
  return (
    <Badge tone={statusTones[status]} {...props}>
      <span className="ui-status-badge__dot" aria-hidden="true" />
      {label ?? statusLabels[status]}
    </Badge>
  )
}
