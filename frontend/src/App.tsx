import { useState } from 'react'

import { guardianMode } from './services/api'
import { PageContainer } from './components/ui/PageContainer'
import Payment from './pages/Payment'
import SecurityOverview from './pages/SecurityOverview'

function ShieldIcon({ size = 20 }: { size?: number }) {
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}><path d="M12 3.25 19 6v5.06c0 4.46-2.87 8.56-7 9.69-4.13-1.13-7-5.23-7-9.69V6l7-2.75Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /><path d="m9.1 12.1 1.85 1.85 3.95-4.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>
}

function LockIcon({ size = 17 }: { size?: number }) {
  return <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}><rect height="9.25" rx="1.8" stroke="currentColor" strokeWidth="1.7" width="13.5" x="5.25" y="10.25" /><path d="M8.25 10.25V7.8a3.75 3.75 0 0 1 7.5 0v2.45" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /><path d="M12 14.2v2.1" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" /></svg>
}

type NavigationTarget = 'overview' | 'pay' | 'guardian'

const navItems: Array<{ label: string; target: NavigationTarget }> = [
  { label: 'Security Overview', target: 'overview' },
  { label: 'Pay', target: 'pay' },
  { label: 'Guardian', target: 'guardian' },
]

function scrollToTarget(target: NavigationTarget) {
  const elementId = target === 'overview' ? 'security-overview' : target === 'pay' ? 'payment' : 'guardian-page'
  const element = document.getElementById(elementId) ?? document.getElementById('payment')
  const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  element?.scrollIntoView({ behavior, block: 'start' })
}

function App() {
  const [activeTarget, setActiveTarget] = useState<NavigationTarget>('overview')
  const isMockMode = guardianMode === 'mock'

  const handleNavigation = (target: NavigationTarget) => {
    setActiveTarget(target)
    scrollToTarget(target)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <PageContainer className="topbar__inner">
          <button className="brand" onClick={() => handleNavigation('overview')} type="button" aria-label="Open Payment Guardian security overview">
            <span className="brand__mark"><ShieldIcon size={20} /></span>
            <span>Payment Guardian</span>
          </button>
          <nav aria-label="Primary navigation" className="topnav">
            {navItems.map((item) => (
              <button
                aria-current={activeTarget === item.target ? 'page' : undefined}
                className={activeTarget === item.target ? 'topnav__link topnav__link--active' : 'topnav__link'}
                key={item.target}
                onClick={() => handleNavigation(item.target)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="topbar__status"><span aria-hidden="true" className="status-dot" />{isMockMode ? 'Mock Guardian mode' : 'Live Guardian mode'}</div>
        </PageContainer>
      </header>

      <main className="app-shell__main" id="top">
        <SecurityOverview isMockMode={isMockMode} onMakePayment={() => handleNavigation('pay')} />
        <Payment />
      </main>

      <footer className="site-footer"><PageContainer className="site-footer__inner"><p className="site-footer__copy">Payment Guardian · A safer moment before every payment.</p><span className="site-footer__meta"><LockIcon size={13} />Frontend does not process payments</span></PageContainer></footer>
    </div>
  )
}

export default App
