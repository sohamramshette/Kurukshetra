import { useCallback, useRef, useState } from 'react'

import { createIdempotencyKey, guardianMode, realGuardianAdapter, type GuardianApiAdapter } from '../services/api'
import { mockGuardianAdapter } from '../services/mockGuardian'
import type { GuardianAnalysisResult, GuardianDecision } from '../types/guardian'
import type { PaymentDraft } from '../types/payment'

export type GuardianSubmissionStatus =
  | 'idle'
  | 'validating'
  | 'analyzing'
  | 'guardian_result'
  | 'action_pending'
  | 'payment_completed'
  | 'payment_cancelled'
  | 'error'
export type GuardianResultSource = 'real' | 'mock'
export type GuardianOutcome = 'allowed' | 'warned' | 'held' | 'blocked'
export type GuardianAction = 'confirm' | 'cancel' | 'acknowledge_guidance'

export interface GuardianState {
  status: GuardianSubmissionStatus
  payment: PaymentDraft | null
  result: GuardianAnalysisResult | null
  error: string | null
  actionError: string | null
  actionMessage: string | null
  pendingAction: GuardianAction | null
  outcome: GuardianOutcome | null
  source: GuardianResultSource
}

const VALIDATION_DELAY = 100
const MOCK_ANALYSIS_DELAY = 900
const configuredAdapter: GuardianApiAdapter<GuardianAnalysisResult> = guardianMode === 'mock' ? mockGuardianAdapter : realGuardianAdapter

function wait(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration))
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function getOutcome(decision: GuardianDecision): GuardianOutcome {
  if (decision === 'ALLOW') return 'allowed'
  if (decision === 'WARN' || decision === 'STEP_UP') return 'warned'
  if (decision === 'HOLD') return 'held'
  return 'blocked'
}

/** Presentation may calculate the countdown, but the backend always rechecks it. */
export function canConfirmResult(result: GuardianAnalysisResult, now = Date.now()) {
  if (result.decision === 'BLOCK' || result.decision === 'HOLD') return false
  if (result.lifecycle.confirmation_allowed) return true
  if (result.lifecycle.status === 'STEP_UP_ACKNOWLEDGED' && result.lifecycle.independent_guidance_acknowledged && result.lifecycle.cooling_ends_at) {
    return new Date(result.lifecycle.cooling_ends_at).getTime() <= now
  }
  return false
}

function initialState(source: GuardianResultSource): GuardianState {
  return {
    status: 'idle', payment: null, result: null, error: null, actionError: null,
    actionMessage: null, pendingAction: null, outcome: null, source,
  }
}

export function useGuardian(adapter: GuardianApiAdapter<GuardianAnalysisResult> = configuredAdapter) {
  const source: GuardianResultSource = adapter.source
  const [state, setState] = useState<GuardianState>(() => initialState(source))
  const operationId = useRef(0)
  const isBusy = useRef(false)
  const actionAttempts = useRef(new Map<string, string>())
  const analysisAttempt = useRef<{ fingerprint: string; key: string } | null>(null)

  const submitPayment = useCallback(async (payment: PaymentDraft) => {
    if (isBusy.current) return
    isBusy.current = true
    actionAttempts.current.clear()
    const fingerprint = JSON.stringify([payment.recipient.trim(), payment.amount, payment.currency, payment.reason.trim()])
    const analysisKey = analysisAttempt.current?.fingerprint === fingerprint ? analysisAttempt.current.key : createIdempotencyKey()
    analysisAttempt.current = { fingerprint, key: analysisKey }
    const currentOperation = ++operationId.current
    setState({ status: 'validating', payment, result: null, error: null, actionError: null, actionMessage: null, pendingAction: null, outcome: null, source })
    try {
      await wait(VALIDATION_DELAY)
      if (currentOperation !== operationId.current) return
      setState({ status: 'analyzing', payment, result: null, error: null, actionError: null, actionMessage: null, pendingAction: null, outcome: null, source })
      if (source === 'mock') await wait(MOCK_ANALYSIS_DELAY)
      if (currentOperation !== operationId.current) return
      const result = await adapter.analyze(payment, analysisKey)
      if (currentOperation !== operationId.current) return
      analysisAttempt.current = null
      setState({ status: 'guardian_result', payment, result, error: null, actionError: null, actionMessage: null, pendingAction: null, outcome: getOutcome(result.decision), source })
    } catch (error) {
      if (currentOperation !== operationId.current) return
      setState({ status: 'error', payment, result: null, error: getErrorMessage(error, 'Guardian could not complete the security check.'), actionError: null, actionMessage: null, pendingAction: null, outcome: null, source })
    } finally {
      if (currentOperation === operationId.current) isBusy.current = false
    }
  }, [adapter, source])

  const runAction = useCallback(async (action: GuardianAction) => {
    if (isBusy.current || state.status !== 'guardian_result' || !state.payment || !state.result) return
    if (action === 'confirm' && !canConfirmResult(state.result)) {
      setState((current) => ({ ...current, actionError: 'Guardian policy does not currently permit this payment to continue.' }))
      return
    }
    isBusy.current = true
    const currentOperation = ++operationId.current
    const { payment, result, outcome } = state
    const attemptId = `${result.transaction_id}:${action}:${result.lifecycle.state_version}`
    const idempotencyKey = actionAttempts.current.get(attemptId) ?? createIdempotencyKey()
    actionAttempts.current.set(attemptId, idempotencyKey)
    setState({ ...state, status: 'action_pending', error: null, actionError: null, actionMessage: null, pendingAction: action })
    try {
      if (action === 'confirm') {
        const confirmation = await adapter.confirm(result, idempotencyKey)
        if (currentOperation !== operationId.current) return
        actionAttempts.current.delete(attemptId)
        const nextResult: GuardianAnalysisResult = { ...result, lifecycle: confirmation.lifecycle }
        setState({ status: 'payment_completed', payment, result: nextResult, error: null, actionError: null, actionMessage: null, pendingAction: null, outcome, source })
        return
      }
      if (action === 'cancel') {
        const cancellation = await adapter.cancel(result, idempotencyKey)
        if (currentOperation !== operationId.current) return
        actionAttempts.current.delete(attemptId)
        const nextResult: GuardianAnalysisResult = { ...result, lifecycle: cancellation.lifecycle }
        setState({ status: 'payment_cancelled', payment, result: nextResult, error: null, actionError: null, actionMessage: null, pendingAction: null, outcome, source })
        return
      }
      const acknowledgement = await adapter.acknowledgeGuidance(result, idempotencyKey)
      if (currentOperation !== operationId.current) return
      actionAttempts.current.delete(attemptId)
      const nextResult: GuardianAnalysisResult = { ...result, lifecycle: acknowledgement.lifecycle }
      setState({ status: 'guardian_result', payment, result: nextResult, error: null, actionError: null, actionMessage: 'Independent-contact guidance acknowledgement was recorded. Guardian has not externally verified the recipient.', pendingAction: null, outcome, source })
    } catch (error) {
      if (currentOperation !== operationId.current) return
      setState({ status: 'guardian_result', payment, result, error: null, actionError: getErrorMessage(error, 'Guardian did not return an action result. Retry safely checks the same action; its final state may have changed.'), actionMessage: null, pendingAction: null, outcome, source })
    } finally {
      if (currentOperation === operationId.current) isBusy.current = false
    }
  }, [adapter, source, state])

  const confirmPayment = useCallback(() => runAction('confirm'), [runAction])
  const cancelPayment = useCallback(() => runAction('cancel'), [runAction])
  const acknowledgeGuidance = useCallback(() => runAction('acknowledge_guidance'), [runAction])
  const reset = useCallback(() => {
    operationId.current += 1
    isBusy.current = false
    actionAttempts.current.clear()
    analysisAttempt.current = null
    setState(initialState(source))
  }, [source])

  return { ...state, acknowledgeGuidance, cancelPayment, confirmPayment, reset, submitPayment }
}
