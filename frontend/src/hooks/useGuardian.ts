import { useCallback, useState } from 'react'

import { guardianMode, realGuardianAdapter, type GuardianApiAdapter } from '../services/api'
import { mockGuardianAdapter } from '../services/mockGuardian'
import type { GuardianAnalysisResult } from '../types/guardian'
import type { PaymentDraft } from '../types/payment'

export type GuardianSubmissionStatus = 'idle' | 'validating' | 'analyzing' | 'guardian_pending' | 'error'
export type GuardianResultSource = 'real' | 'mock'

export interface GuardianState {
  status: GuardianSubmissionStatus
  payment: PaymentDraft | null
  result: GuardianAnalysisResult | null
  error: string | null
  source: GuardianResultSource
}

const MOCK_VALIDATION_DELAY = 180
const MOCK_ANALYSIS_DELAY = 900
const configuredAdapter: GuardianApiAdapter<GuardianAnalysisResult> = guardianMode === 'mock' ? mockGuardianAdapter : realGuardianAdapter

function wait(duration: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration)
  })
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Guardian analysis failed. Please try again.'
}

export function useGuardian(adapter: GuardianApiAdapter<GuardianAnalysisResult> = configuredAdapter) {
  const source: GuardianResultSource = adapter === mockGuardianAdapter ? 'mock' : 'real'
  const [state, setState] = useState<GuardianState>({
    status: 'idle',
    payment: null,
    result: null,
    error: null,
    source,
  })

  const submitPayment = useCallback(async (payment: PaymentDraft) => {
    setState({ status: 'validating', payment, result: null, error: null, source })
    if (source === 'mock') {
      await wait(MOCK_VALIDATION_DELAY)
    }

    setState({ status: 'analyzing', payment, result: null, error: null, source })
    if (source === 'mock') {
      await wait(MOCK_ANALYSIS_DELAY)
    }

    try {
      const result = await adapter.analyze(payment)
      setState({ status: 'guardian_pending', payment, result, error: null, source })
    } catch (error) {
      setState({ status: 'error', payment, result: null, error: getErrorMessage(error), source })
    }
  }, [adapter, source])

  const reset = useCallback(() => {
    setState({ status: 'idle', payment: null, result: null, error: null, source })
  }, [source])

  return {
    ...state,
    reset,
    submitPayment,
  }
}
