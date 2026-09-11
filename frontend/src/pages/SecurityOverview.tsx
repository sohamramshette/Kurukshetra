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
]

const intelligence = [
  { icon: '◎', name: 'Recipient reputation', description: 'Profile history, familiarity, and shared trust signals.' },
  { icon: '↗', name: 'Transaction anomaly', description: 'Amount, velocity, and pattern-deviation checks.' },
  { icon: '✦', name: 'Scam language', description: 'Urgency, impersonation, and social-engineering cues.' },
  { icon: '✓', name: 'Identity verification', description: 'Claims that need independent confirmation.' },
]

const journeyBenefits = [
  { title: 'No automatic payment', copy: 'Guardian reviews context before any payment action.' },
  { title: 'Explainable decisions', copy: 'Every warning is connected to visible evidence.' },
  { title: 'Human control retained', copy: 'Verify, cancel, or review without hidden automation.' },
]

const flowSteps = [
  { stage: 'OBSERVE', copy: 'Receive payment context.' },
  { stage: 'REASON', copy: 'Connect risk signals.' },
  { stage: 'VERIFY', copy: 'Check critical claims.' },
  { stage: 'REASSESS', copy: 'Update the risk picture.' },
  { stage: 'ACT', copy: 'Apply the safest decision.' },
  { stage: 'EXPLAIN', copy: 'Show why it happened.' },
]

export default function SecurityOverview({ isMockMode, onMakePayment }: SecurityOverviewProps) {
  return (
    <section className="overview-page" id="security-overview" aria-labelledby="overview-title">
      <div className="overview-hero">
        <PageContainer className="overview-hero__inner">
          <div className="overview-hero__copy">
            <p className="eyebrow eyebrow--hero"><span aria-hidden="true" className="eyebrow__line" />AI-assisted payment protection</p>
            <h1 className="overview-page__title" id="overview-title">Pay smarter.<span>Stay protected.</span></h1>
            <p className="overview-page__subtitle">Review recipient trust, transaction anomalies, and scam signals before money moves—with clear evidence and control at every step.</p>
            <div className="overview-hero__actions">
              <Button onClick={onMakePayment} size="lg">Start a protected payment <span aria-hidden="true">→</span></Button>
              <Badge tone="neutral">{isMockMode ? 'Safe demo mode' : 'Live Guardian configured'}</Badge>
            </div>
            <ul className="overview-hero__trust" aria-label="Payment Guardian benefits">
              <li><span aria-hidden="true">✓</span>No payment sent automatically</li>
              <li><span aria-hidden="true">✓</span>Evidence-first decisions</li>
              <li><span aria-hidden="true">✓</span>Human override control</li>
            </ul>
          </div>

          <div className="overview-hero__visual" aria-label="Payment Guardian product preview">
            <div className="overview-product-card overview-product-card--back" aria-hidden="true">
              <span className="overview-product-card__bar" />
              <span className="overview-product-card__line" />
              <span className="overview-product-card__line overview-product-card__line--short" />
            </div>
            <div className="overview-product-card overview-product-card--main">
              <div className="overview-product-card__header">
                <div><span className="overview-product-card__logo">G</span><strong>Guardian review</strong></div>
                <StatusBadge label="Protected" status="protected" />
              </div>
              <div className="overview-product-card__amount"><span>Payment amount</span><strong>₹25,000</strong></div>
              <div className="overview-product-card__risk">
                <div><span>Risk review</span><strong>86 / 100</strong></div>
                <div className="overview-product-card__meter"><span /></div>
              </div>
              <div className="overview-product-card__decision">
                <span className="overview-product-card__shield" aria-hidden="true">✓</span>
                <div><small>Guardian decision</small><strong>Verify before paying</strong></div>
              </div>
              <div className="overview-product-card__checks">
                <span>Recipient</span><span>Amount</span><span>Scam pattern</span>
              </div>
            </div>
            <div className="overview-hero__floating overview-hero__floating--top"><span aria-hidden="true">✦</span><div><strong>6 checks complete</strong><small>Context verified</small></div></div>
            <div className="overview-hero__floating overview-hero__floating--bottom"><span aria-hidden="true">✓</span><div><strong>Payment paused</strong><small>You stay in control</small></div></div>
          </div>
        </PageContainer>
      </div>

      <div className="overview-content">
        <PageContainer>
          <div className="overview-section-heading overview-section-heading--centered">
            <div>
              <p className="overview-section-heading__eyebrow">Explore Guardian protection</p>
              <h2>Security that understands payment context</h2>
              <p>Guardian combines multiple signals to make every review useful, calm, and explainable.</p>
            </div>
          </div>

          <div className="overview-intelligence-options">
            {intelligence.map((item) => (
              <Card className="overview-intelligence-option" key={item.name}>
                <span className="overview-intelligence-option__icon" aria-hidden="true">{item.icon}</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <button onClick={onMakePayment} type="button">Explore check <span aria-hidden="true">→</span></button>
              </Card>
            ))}
          </div>

          <div className="overview-section-heading">
            <div>
              <p className="overview-section-heading__eyebrow">Protection snapshot</p>
              <h2>Security metrics at a glance</h2>
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

          <div className="overview-journey">
            <div className="overview-journey__copy">
              <p className="overview-section-heading__eyebrow">Start your journey</p>
              <h2>Protection without the friction.</h2>
              <p>Guardian adds a thoughtful security moment without taking control away from you.</p>
              <ul>
                {journeyBenefits.map((benefit) => (
                  <li key={benefit.title}><span aria-hidden="true">✓</span><div><strong>{benefit.title}</strong><p>{benefit.copy}</p></div></li>
                ))}
              </ul>
              <Button onClick={onMakePayment} size="lg">Make a payment</Button>
            </div>
            <div className="overview-journey__visual" aria-label="Zero automatic payment actions">
              <span className="overview-journey__tag">Automatic payments</span>
              <div className="overview-journey__zero"><span>₹</span>0</div>
              <div className="overview-journey__gauge"><span /></div>
              <strong>Nothing moves without you</strong>
              <p>Guardian analyzes and explains. You decide what happens next.</p>
            </div>
          </div>

          <div className="overview-showcase">
            <div className="overview-showcase__activity">
              <div className="overview-showcase__phone">
                <div className="overview-showcase__phone-top"><span>9:41</span><strong>Guardian</strong><span>•••</span></div>
                <div className="overview-showcase__phone-balance"><small>Protected volume</small><strong>₹1,24,800</strong><span>Demo overview</span></div>
                <ul className="overview-activity-list">
                  {activity.map((item) => (
                    <li className="overview-activity-item" key={`${item.event}-${item.time}`}>
                      <span className={`overview-activity-item__marker overview-activity-item__marker--${item.status}`} aria-hidden="true" />
                      <div className="overview-activity-item__content"><h3>{item.event}</h3><p>{item.time}</p></div>
                      <StatusBadge label={item.label} status={item.status} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="overview-showcase__copy">
              <p className="overview-section-heading__eyebrow">Designed for payments</p>
              <h2>Built for trust.</h2>
              <p>One clear workflow brings risk signals, verification, and the final decision together.</p>
              <ol className="overview-flow" aria-label="Guardian protection stages">
                {flowSteps.map((step, index) => (
                  <li key={step.stage}>
                    <span className="overview-flow__index">0{index + 1}</span>
                    <div><strong>{step.stage}</strong><p>{step.copy}</p></div>
                    <span className="overview-flow__arrow" aria-hidden="true">+</span>
                  </li>
                ))}
              </ol>
              <p className="overview-card__footnote">All activity and metrics shown here are illustrative demo data.</p>
            </div>
          </div>
        </PageContainer>
      </div>
    </section>
  )
}
