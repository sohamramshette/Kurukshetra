import { Badge } from './ui/Badge'
import type { GuardianRiskLevel } from '../types/guardian'

export interface RiskBadgeProps {
  level: GuardianRiskLevel
  score: number
}

const levelTone: Record<GuardianRiskLevel, 'success' | 'warning' | 'hold' | 'danger'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'hold',
  CRITICAL: 'danger',
}

export function RiskBadge({ level, score }: RiskBadgeProps) {
  return (
    <div aria-label={`Risk score ${score} out of 100, ${level} risk`} className={`risk-badge risk-badge--${level.toLowerCase()}`}>
      <div className="risk-badge__score">
        <span className="risk-badge__number">{score}</span>
        <span className="risk-badge__denominator">/ 100</span>
      </div>
      <div aria-label={`Risk progress ${score}%`} className="risk-badge__progress" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={score}>
        <span style={{ width: `${score}%` }} />
      </div>
      <Badge tone={levelTone[level]}>{level} RISK</Badge>
    </div>
  )
}
