import type { SensorAnalysisResult } from '../types/guardian'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'

interface ThreatSensorPanelProps {
  sensorAnalysis?: SensorAnalysisResult
  recipientHandle?: string
  paymentAmount?: string
}

export function ThreatSensorPanel({
  sensorAnalysis,
  recipientHandle = 'Recipient',
  paymentAmount = '₹25,000',
}: ThreatSensorPanelProps) {
  if (!sensorAnalysis) {
    return (
      <Card className="threat-sensor-card threat-sensor-card--empty">
        <p>No hardware threat sensor telemetry available for this payment.</p>
      </Card>
    )
  }

  const { active_call, screen_sharing, biometric_dynamics, device_integrity, signals, countermeasures } = sensorAnalysis
  const isCompromised = sensorAnalysis.status.includes('CRITICAL') || screen_sharing.detected
  const isCoerced = active_call.detected || sensorAnalysis.status.includes('COERCION')

  return (
    <Card className="threat-sensor-card">
      {/* 1. Header & Live Indicator */}
      <div className="threat-sensor-header">
        <div>
          <div className="threat-sensor-header__badge-row">
            <span className="guardian-panel__eyebrow">Hardware Sensors &amp; Biometric Telemetry</span>
            <span className="threat-sensor-pulse-dot" />
            <span className="threat-sensor-live-text">Live Device Telemetry</span>
          </div>
          <h2 className="guardian-panel__title">Silent Threat Sensors &amp; Duress Monitor</h2>
          <p className="threat-sensor-header__subtitle">
            Monitors active phone calls, background remote screen-sharing tools, keystroke dynamics, and device sandbox integrity before payment execution.
          </p>
        </div>

        <div className="threat-sensor-overall-status">
          <Badge
            tone={
              isCompromised
                ? 'danger'
                : isCoerced
                ? 'danger'
                : biometric_dynamics.hesitation_index >= 60
                ? 'warning'
                : 'success'
            }
            className="threat-sensor-status-badge"
          >
            {sensorAnalysis.status.replace(/_/g, ' ')}
          </Badge>
          {sensorAnalysis.total_score_delta > 0 && (
            <span className="threat-sensor-delta-pill">
              +{sensorAnalysis.total_score_delta} Sensor Risk Delta
            </span>
          )}
        </div>
      </div>

      {/* 2. 4 Sensor Status Cards Grid */}
      <div className="threat-sensor-grid">
        {/* Card 1: Active Call Voice Coercion */}
        <div className={`sensor-item-card ${active_call.detected ? 'sensor-item-card--danger' : 'sensor-item-card--safe'}`}>
          <div className="sensor-item-card__header">
            <div className="sensor-item-card__icon-wrap">
              <span className="sensor-item-card__icon">📞</span>
              <div>
                <h3 className="sensor-item-card__title">Voice Call Coercion</h3>
                <span className="sensor-item-card__category">Audio / In-Call State</span>
              </div>
            </div>
            <span className={`sensor-item-card__led ${active_call.detected ? 'sensor-item-card__led--active-red' : 'sensor-item-card__led--green'}`} />
          </div>

          <div className="sensor-item-card__body">
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Call State:</span>
              <span className={`sensor-item-card__metric-val ${active_call.detected ? 'text-danger font-bold' : ''}`}>
                {active_call.detected ? `ACTIVE CALL (${active_call.duration_formatted})` : 'IDLE (No ongoing call)'}
              </span>
            </div>
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Network Type:</span>
              <span className="sensor-item-card__metric-val">{active_call.call_type.toUpperCase()} Voice Link</span>
            </div>
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Risk Attribution:</span>
              <span className="sensor-item-card__metric-val font-semibold">{active_call.risk_attribution}</span>
            </div>

            <p className="sensor-item-card__desc">
              {active_call.detected
                ? 'Scammer is actively keeping victim on a live phone call to dictate transfers and prevent independent thinking.'
                : 'No voice call active during payment entry. Clean isolated session.'}
            </p>
          </div>
        </div>

        {/* Card 2: Remote Screen Sharing / RAT */}
        <div className={`sensor-item-card ${screen_sharing.detected ? 'sensor-item-card--danger' : 'sensor-item-card--safe'}`}>
          <div className="sensor-item-card__header">
            <div className="sensor-item-card__icon-wrap">
              <span className="sensor-item-card__icon">🖥️</span>
              <div>
                <h3 className="sensor-item-card__title">Screen Sharing / RAT</h3>
                <span className="sensor-item-card__category">Remote Access Tool</span>
              </div>
            </div>
            <span className={`sensor-item-card__led ${screen_sharing.detected ? 'sensor-item-card__led--active-red' : 'sensor-item-card__led--green'}`} />
          </div>

          <div className="sensor-item-card__body">
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Mirror State:</span>
              <span className={`sensor-item-card__metric-val ${screen_sharing.detected ? 'text-danger font-bold' : ''}`}>
                {screen_sharing.detected ? 'MIRRORING DETECTED' : 'SECURE (No screen sharing)'}
              </span>
            </div>
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Tool / Process:</span>
              <span className="sensor-item-card__metric-val font-semibold">
                {screen_sharing.tool_name ?? 'None active'}
              </span>
            </div>
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Risk Attribution:</span>
              <span className="sensor-item-card__metric-val font-semibold">{screen_sharing.risk_attribution}</span>
            </div>

            <p className="sensor-item-card__desc">
              {screen_sharing.detected
                ? 'Remote access software is streaming the screen in real-time. Extreme risk of credential and OTP exfiltration.'
                : 'Display sandbox intact. No unauthorized screen capture or mirroring session.'}
            </p>
          </div>
        </div>

        {/* Card 3: Biometric Keystroke Dynamics */}
        <div className={`sensor-item-card ${biometric_dynamics.hesitation_index >= 60 ? 'sensor-item-card--warning' : 'sensor-item-card--safe'}`}>
          <div className="sensor-item-card__header">
            <div className="sensor-item-card__icon-wrap">
              <span className="sensor-item-card__icon">⌨️</span>
              <div>
                <h3 className="sensor-item-card__title">Keystroke Dynamics</h3>
                <span className="sensor-item-card__category">Biometric Stress Sensor</span>
              </div>
            </div>
            <span className={`sensor-item-card__led ${biometric_dynamics.hesitation_index >= 60 ? 'sensor-item-card__led--active-amber' : 'sensor-item-card__led--green'}`} />
          </div>

          <div className="sensor-item-card__body">
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Hesitation Index:</span>
              <span className="sensor-item-card__metric-val font-bold">
                {biometric_dynamics.hesitation_index}/100 ({biometric_dynamics.stress_band})
              </span>
            </div>
            {/* Visual Hesitation Meter */}
            <div className="biometric-meter">
              <div
                className="biometric-meter__bar"
                style={{
                  width: `${biometric_dynamics.hesitation_index}%`,
                  backgroundColor: biometric_dynamics.hesitation_index >= 75 ? '#ef4444' : biometric_dynamics.hesitation_index >= 50 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>

            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Inter-Key Latency:</span>
              <span className="sensor-item-card__metric-val">
                {(biometric_dynamics.inter_key_latency_ms / 1000).toFixed(2)}s hesitation
              </span>
            </div>
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">VPA Clipboard Paste:</span>
              <span className="sensor-item-card__metric-val font-semibold">
                {biometric_dynamics.clipboard_paste_detected ? '⚠️ Copied from external app' : '✓ Manually typed'}
              </span>
            </div>

            <p className="sensor-item-card__desc">
              {biometric_dynamics.clipboard_paste_detected
                ? 'High typing hesitation and clipboard paste indicate user was instructed to copy an unfamiliar VPA under stress.'
                : 'Typing cadence is fluid and consistent with familiar payments.'}
            </p>
          </div>
        </div>

        {/* Card 4: Device Sandbox & Integrity */}
        <div className={`sensor-item-card ${device_integrity.sandbox_state === 'COMPROMISED' ? 'sensor-item-card--danger' : device_integrity.sandbox_state === 'WARNING' ? 'sensor-item-card--warning' : 'sensor-item-card--safe'}`}>
          <div className="sensor-item-card__header">
            <div className="sensor-item-card__icon-wrap">
              <span className="sensor-item-card__icon">🛡️</span>
              <div>
                <h3 className="sensor-item-card__title">Device Sandbox</h3>
                <span className="sensor-item-card__category">Environment Integrity</span>
              </div>
            </div>
            <span className={`sensor-item-card__led ${device_integrity.sandbox_state === 'COMPROMISED' ? 'sensor-item-card__led--active-red' : 'sensor-item-card__led--green'}`} />
          </div>

          <div className="sensor-item-card__body">
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Sandbox State:</span>
              <span className="sensor-item-card__metric-val font-bold">{device_integrity.sandbox_state}</span>
            </div>
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Accessibility Overlay:</span>
              <span className="sensor-item-card__metric-val">
                {device_integrity.accessibility_abuse ? '⚠️ Active overlay permission' : '✓ Normal'}
              </span>
            </div>
            <div className="sensor-item-card__metric">
              <span className="sensor-item-card__metric-label">Developer Mode:</span>
              <span className="sensor-item-card__metric-val">
                {device_integrity.developer_mode ? 'Enabled (USB Debug)' : 'Disabled'}
              </span>
            </div>

            <p className="sensor-item-card__desc">
              {device_integrity.accessibility_abuse
                ? 'A background app holds accessibility inspection permissions, capable of intercepting banking PIN and OTP inputs.'
                : 'Operating system sandbox is intact with no malicious overlay hooks.'}
            </p>
          </div>
        </div>
      </div>

      {/* 2.5 Active Sensor Threat Signals */}
      {signals.length > 0 && (
        <div className="threat-sensor-signals">
          <h4 className="threat-sensor-actions__title">⚠️ Inferred Threat Signals:</h4>
          <div className="threat-sensor-signals__tags">
            {signals.map((sig, idx) => (
              <div key={idx} className="threat-sensor-signal-tag">
                <span className="threat-sensor-signal-tag__type">{sig.type}</span>
                <span className="threat-sensor-signal-tag__delta">+{sig.score_delta} Risk</span>
                <span className="threat-sensor-signal-tag__reason">{sig.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Hardware Countermeasures Checklist */}
      <div className="threat-sensor-actions">
        <h4 className="threat-sensor-actions__title">🛡️ Guardian Automated Hardware Countermeasures:</h4>
        <div className="threat-sensor-actions__list">
          {countermeasures.map((cm, idx) => (
            <div key={idx} className="threat-sensor-action-item">
              <span className="threat-sensor-action-item__icon">⚡</span>
              <span className="threat-sensor-action-item__text">{cm}</span>
            </div>
          ))}
          <div className="threat-sensor-action-item">
            <span className="threat-sensor-action-item__icon">🔒</span>
            <span className="threat-sensor-action-item__text">
              Hold {paymentAmount} transfer to {recipientHandle} pending telemetric clearance.
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
