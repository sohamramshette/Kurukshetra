export interface PaymentDraft {
  recipient: string
  amount: string
  currency: 'INR'
  reason: string
}

export type DemoScenario = 'safe' | 'suspicious'

export interface DemoScenarioDefinition {
  label: string
  description: string
  values: PaymentDraft
}

export const DEMO_PAYMENT_SCENARIOS: Record<DemoScenario, DemoScenarioDefinition> = {
  safe: {
    label: 'Safe payment',
    description: 'Known recipient with a normal amount and ordinary reason.',
    values: {
      recipient: 'riya@trusted-demo.com',
      amount: '2400',
      currency: 'INR',
      reason: 'Monthly service payment',
    },
  },
  suspicious: {
    label: 'Suspicious payment',
    description: 'New support recipient with a large refund-related request.',
    values: {
      recipient: 'support-verify@electricity-dept.in',
      amount: '25000',
      currency: 'INR',
      reason: 'Dear customer, your electricity power will be disconnected tonight at 9:30 PM. Pay verification fee.',
    },
  },
}

export function classifyDemoPayment(payment: PaymentDraft): DemoScenario {
  const recipient = payment.recipient.trim().toLowerCase()
  const reason = payment.reason.trim().toLowerCase()
  const amount = Number(payment.amount.replace(/,/g, ''))
  const hasSuspiciousReason = /(refund|urgent|verification|suspension)/.test(reason)
  const isSupportRecipient = recipient.startsWith('support@')
  const isLargePayment = Number.isFinite(amount) && amount >= 20000

  return isSupportRecipient || (isLargePayment && hasSuspiciousReason) ? 'suspicious' : 'safe'
}
