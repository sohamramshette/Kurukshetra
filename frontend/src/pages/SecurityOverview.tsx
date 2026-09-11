import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { PageContainer } from '../components/ui/PageContainer'
import { StatusBadge } from '../components/ui/StatusBadge'

interface SecurityOverviewProps {
  isMockMode: boolean
  onMakePayment: () => void
}

const metrics = [
  { label: 'Payments protected', value: '₹1,24,800', detail: 'Simulated protected volume', tone: 'accent' as const },
  { label: 'Threats intercepted', value: '7', detail: 'Simulated held decisions', tone: 'hold' as const },
  { label: 'High-risk payments', value: '3', detail: 'Simulated elevated reviews', tone: 'danger' as const },
  { label: 'Protection rate', value: '98.7%', detail: 'Simulated demo ratio', tone: 'success' as const },
]

const activity = [
  { event: 'Payment held', detail: 'Suspicious recipient and urgency pressure detected.', time: '2 min ago', status: 'hold' as const, label: 'Held' },
  { event: 'Recipient verification required', detail: 'A new recipient needs independent confirmation.', time: '18 min ago', status: 'warning' as const, label: 'Review' },
  { event: 'Utility impersonation pattern detected', detail: 'Electricity disconnection language matched a scam pattern.', time: '42 min ago', status: 'danger' as const, label: 'Critical' },
  { event: 'Safe payment cleared', detail: 'Recipient and transaction context stayed within expected bounds.', time: '1 hr ago', status: 'secure' as const, label: 'Cleared' },
  { event: 'High-value transaction flagged', detail: 'Amount deviation triggered a protective review.', time: '3 hrs ago', status: 'warning' as const, label: 'Flagged' },
]

const intelligence = [
  { name: 'Recipient reputation', description: 'Profile history and familiarity' },
  { name: 'Transaction anomaly', description: 'Amount and pattern deviation' },
  { name: 'Scam language', description: 'Urgency and social-engineering cues' },
  { name: 'Identity claims', description: 'Claims that need independent checks' },
  { name: 'Transaction velocity', description: 'Frequency and timing context' },
  { name: 'Collective reputation', description: 'Shared signals around the recipient' },
]

const flowSteps = [
  { stage: 'OBSERVE', copy: 'Receive the payment context.' },
  { stage: 'REASON', copy: 'Connect signals and intent.' },
  { stage: 'VERIFY', copy: 'Check the highest-risk claims.' },
  { stage: 'REASSESS', copy: 'Update the risk picture.' },
  { stage: 'ACT', copy: 'Hold, allow, or ask for review.' },
  { stage: 'EXPLAIN', copy: 'Show why the decision happened.' },
]

export default function SecurityOverview({ isMockMode, onMakePayment }: SecurityOverviewProps) {
  return (
    <section className="overview-page" id="security-overview" aria-labelledby="overview-title">
      <PageContainer>
        <div className="overview-page__header">
          <div>
            <p className="eyebrow"><span aria-hidden="true" className="eyebrow__line" />Security overview</p>
            <h1 className="overview-page__title" id="overview-title">Guardian is protecting your payments.</h1>
            <p className="overview-page__subtitle">A calm command center for the moment before money moves — with clear context, visible evidence, and human control.</p>
          </div>
          <div className="overview-page__header-actions">
            <Badge tone="neutral">Demo environment</Badge>
            <Button onClick={onMakePayment} size="lg">Make a Payment <span aria-hidden="true">↗</span></Button>
          </div>
        </div>

        <Card className="overview-status-card" elevated>
          <div className="overview-status-card__main">
            <div className="overview-status-card__shield" aria-hidden="true">✓</div>
            <div>
              <div className="overview-status-card__label"><span className="status-dot" />Guardian status</div>
              <h2>ACTIVE / PROTECTING</h2>
              <p>Pre-payment context monitoring is ready. Guardian pauses suspicious activity before a payment can move forward.</p>
            </div>
          </div>
          <div className="overview-status-card__side">
            <StatusBadge label={isMockMode ? 'Simulated Guardian mode' : 'Guardian mode configured'} status="protected" />
            <span>Analysis boundary armed</span>
          </div>
        </Card>

        <div className="overview-section-heading">
          <div>
            <p className="overview-section-heading__eyebrow">Protection snapshot</p>
            <h2>Security metrics</h2>
          </div>
          <Badge tone="neutral">Simulated demo data</Badge>
        </div>
        <div className="overview-metrics" aria-label="Simulated security metrics">
          {metrics.map((metric) => (
            <Card className="overview-metric" key={metric.label}>
              <div className={`overview-metric__signal overview-metric__signal--${metric.tone}`} aria-hidden="true" />
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <span>{metric.detail}</span>
            </Card>
          ))}
        </div>

        <div className="overview-grid">
          <Card className="overview-activity-card">
            <div className="overview-card__header">
              <div>
                <p className="overview-card__eyebrow">Recent security activity</p>
                <h2 className="overview-card__title">What Guardian has noticed</h2>
              </div>
              <Badge tone="neutral">Simulated activity</Badge>
            </div>
            <ul className="overview-activity-list">
              {activity.map((item) => (
                <li className="overview-activity-item" key={`${item.event}-${item.time}`}>
                  <span className={`overview-activity-item__marker overview-activity-item__marker--${item.status}`} aria-hidden="true" />
                  <div className="overview-activity-item__content">
                    <div className="overview-activity-item__topline"><h3>{item.event}</h3><StatusBadge label={item.label} status={item.status} /></div>
                    <p>{item.detail}</p>
                    <time>{item.time}</time>
                  </div>
                </li>
              ))}
            </ul>
            <p className="overview-card__footnote">These events are illustrative demo activity, not banking or fraud statistics.</p>
          </Card>

          <Card className="overview-intelligence-card">
            <div className="overview-card__header">
              <div>
                <p className="overview-card__eyebrow">Guardian intelligence</p>
                <h2 className="overview-card__title">Verification categories</h2>
              </div>
              <Badge tone="accent">Context checks</Badge>
            </div>
            <ul className="overview-intelligence-list">
              {intelligence.map((item, index) => (
                <li key={item.name}>
                  <span className="overview-intelligence-list__number">0{index + 1}</span>
                  <div><h3>{item.name}</h3><p>{item.description}</p></div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="overview-flow-card">
          <div className="overview-card__header">
            <div>
              <p className="overview-card__eyebrow">Agentic protection flow</p>
              <h2 className="overview-card__title">From observation to explanation</h2>
            </div>
            <Badge tone="success">Guardian loop</Badge>
          </div>
          <ol className="overview-flow" aria-label="Guardian protection stages">
            {flowSteps.map((step, index) => (
              <li key={step.stage}>
                <span className="overview-flow__index">0{index + 1}</span>
                <strong>{step.stage}</strong>
                <p>{step.copy}</p>
                {index < flowSteps.length - 1 ? <span className="overview-flow__arrow" aria-hidden="true">→</span> : null}
              </li>
            ))}
          </ol>
        </Card>
      </PageContainer>
    </section>
  )
}
