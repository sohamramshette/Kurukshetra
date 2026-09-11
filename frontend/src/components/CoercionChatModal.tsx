import { useState, useEffect, useRef, type FormEvent } from 'react'
import type { CoercionAssessment, ConversationTurnResponse, GuardianDecision } from '../types/guardian'
import type { PaymentDraft } from '../types/payment'
import { converseGuardian } from '../services/api'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/StatusBadge'

export type InterviewLanguage = 'en' | 'hinglish' | 'hi'

export interface CoercionChatModalProps {
  transactionId: string
  initialRiskScore?: number
  payment?: PaymentDraft
  isOpen: boolean
  onClose: () => void
  onDecisionUpdated?: (newDecision: GuardianDecision, reason: string) => void
}

interface ChatMessage {
  id: string
  sender: 'guardian' | 'user'
  text: string
  timestamp: string
}

function getContextualSuggestions(reason: string = '', language: InterviewLanguage): string[] {
  const r = reason.toLowerCase()
  const isElectricity = r.includes('electricity') || r.includes('power') || r.includes('bijli') || r.includes('disconnect')
  const isKycOrBank = r.includes('kyc') || r.includes('sbi') || r.includes('bank') || r.includes('refund') || r.includes('pan')
  const isCrypto = r.includes('crypto') || r.includes('invest') || r.includes('profit') || r.includes('yield')

  if (language === 'hi') {
    if (isElectricity) {
      return [
        'बिजली विभाग के अधिकारी का फोन आया था, तुरंत भरने को कहा।',
        'मुझे संदेश मिला कि आज रात बिजली काट दी जाएगी।',
        'नहीं, यह मेरा सामान्य मासिक बिल भुगतान है।',
      ]
    }
    if (isKycOrBank) {
      return [
        'बैंक से फोन आया कि केवाईसी बंद हो गया है, तुरंत फीस जमा करें।',
        'कहा गया कि भुगतान न करने पर खाता सीज हो जाएगा।',
        'नहीं, मैं अपने किसी परिचित को पैसे भेज रहा हूँ।',
      ]
    }
    if (isCrypto) {
      return [
        'टेलीग्राम/व्हाट्सएप पर किसी ने गारंटीड रिटर्न का वादा किया था।',
        'उन्होंने कहा कि छोटा निवेश करके बड़ा फायदा होगा।',
        'नहीं, मैं खुद समझदारी से निवेश कर रहा हूँ।',
      ]
    }
    return [
      'हाँ, किसी ने फोन पर मुझे यह भुगतान तुरंत करने का निर्देश दिया था।',
      'उन्होंने चेतावनी दी कि अभी भुगतान न करने पर बड़ा नुकसान होगा।',
      'नहीं, मैं अपनी मर्जी से यह भुगतान कर रहा हूँ।',
    ]
  }

  if (language === 'hinglish') {
    if (isElectricity) {
      return [
        'Electricity department se call aaya tha, unhone bola abhi pay karo warna power cut jayegi.',
        'Mujhe SMS mila ki 9:30 baje connection kat diya jayega.',
        'Nahi, ye mera normal monthly bill payment hai.',
      ]
    }
    if (isKycOrBank) {
      return [
        'Bank officer ka call aaya ki KYC expire ho gaya hai, turant update fee bhejo.',
        'Unhone bola fee nahi di to account block ho jayega.',
        'Nahi, main apne kisi jaan-pehchaan wale ko bhej raha hu.',
      ]
    }
    if (isCrypto) {
      return [
        'WhatsApp/Telegram par kisi ne high profit ka lalach diya.',
        'Unhone pehle chota payment karwake trust jeeta.',
        'Nahi, ye mera verified investment platform hai.',
      ]
    }
    return [
      'Haan, kisi ne phone par instruction diya ki abhi transfer karo.',
      'Unhone bola agar abhi pay nahi kiya to nuksan hoga.',
      'Nahi, main apni marzi se pay kar raha hu.',
    ]
  }

  // English
  if (isElectricity) {
    return [
      'Someone claiming to be from the electricity office called and demanded payment.',
      'I received an urgent notice claiming power will be cut off tonight.',
      'No, this is my regular scheduled utility bill payment.',
    ]
  }
  if (isKycOrBank) {
    return [
      'A bank officer called saying my KYC expired and demanded a verification fee.',
      'They claimed my account will be frozen within an hour if I do not pay.',
      'No, I know this recipient and am paying voluntarily.',
    ]
  }
  if (isCrypto) {
    return [
      'An online advisor promised guaranteed returns and instructed me to deposit.',
      'They told me to act fast before the profit window closes.',
      'No, I am transferring to my own verified personal wallet.',
    ]
  }

  return [
    'Yes, someone called me and instructed me to make this payment.',
    'They warned me of severe consequences if I did not pay immediately.',
    'A stranger online promised me a refund / reward.',
    'No, I am paying of my own choice and know the recipient.',
  ]
}

export function CoercionChatModal({
  initialRiskScore = 85,
  isOpen,
  onClose,
  onDecisionUpdated,
  payment,
  transactionId,
}: CoercionChatModalProps) {
  const [language, setLanguage] = useState<InterviewLanguage>('en')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [turnsCompleted, setTurnsCompleted] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [assessment, setAssessment] = useState<CoercionAssessment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [liveRiskScore, setLiveRiskScore] = useState<number>(initialRiskScore)
  const [reportedHelpline, setReportedHelpline] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, assessment])

  // Initialize conversation when modal opens or language changes
  useEffect(() => {
    if (!isOpen || !transactionId) return

    setMessages([])
    setInputText('')
    setIsComplete(false)
    setAssessment(null)
    setError(null)
    setTurnsCompleted(0)
    setLiveRiskScore(initialRiskScore)
    setReportedHelpline(false)

    let isMounted = true

    const startInterview = async () => {
      setIsLoading(true)
      try {
        const firstTurn: ConversationTurnResponse = await converseGuardian(transactionId, undefined, language)
        if (!isMounted) return

        if (firstTurn.question) {
          setMessages([
            {
              id: `init-${language}-${Date.now()}`,
              sender: 'guardian',
              text: firstTurn.question,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ])
        }
        setTurnsCompleted(firstTurn.turns_completed || 0)
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Could not start safety interview.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void startInterview()

    return () => {
      isMounted = false
    }
  }, [isOpen, transactionId, language])

  if (!isOpen) return null

  const handleSendAnswer = async (answerText: string) => {
    const text = answerText.trim()
    if (!text || isLoading || isComplete) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsLoading(true)
    setError(null)

    // Intermediate risk score animation
    const hasCoercionKeywords = /(yes|called|told|disconnect|power|bijli|police|arrest|urgent|dhamki|haan|ha)/i.test(text)
    if (hasCoercionKeywords) {
      setLiveRiskScore((prev) => Math.min(100, Math.max(prev, 96)))
    } else {
      setLiveRiskScore((prev) => Math.max(35, prev - 15))
    }

    try {
      const response: ConversationTurnResponse = await converseGuardian(transactionId, text, language)

      setTurnsCompleted(response.turns_completed)

      if (response.conversation_complete && response.coercion_assessment) {
        setIsComplete(true)
        setAssessment(response.coercion_assessment)

        if (response.coercion_assessment.coercion_detected) {
          setLiveRiskScore(100)
        }

        if (response.coercion_assessment.updated_decision && onDecisionUpdated) {
          onDecisionUpdated(
            response.coercion_assessment.updated_decision,
            response.coercion_assessment.assessment
          )
        }
      } else if (response.question) {
        const guardianMsg: ChatMessage = {
          id: `guardian-${Date.now()}`,
          sender: 'guardian',
          text: response.question,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, guardianMsg])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record response. Please retry.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSendAnswer(inputText)
  }

  const handleReportHelpline = () => {
    setReportedHelpline(true)
  }

  const handleDownloadReport = () => {
    const lines = [
      '====================================================',
      '      KURUKSHETRA PAYMENT GUARDIAN (PS09)',
      '         INCIDENT SECURITY REPORT',
      '====================================================',
      `Date & Time: ${new Date().toISOString()}`,
      `Transaction Ref: ${transactionId}`,
      `Payer: Aarav Mehta (Demo User)`,
      `Counterparty / Recipient: ${payment?.recipient || 'support-verify@electricity-dept.in'}`,
      `Attempted Amount: ₹${payment?.amount ? Number(payment.amount).toLocaleString('en-IN') : '25,000'} INR`,
      `Payment Reason / Note: ${payment?.reason || 'Electricity disconnection verification'}`,
      '----------------------------------------------------',
      'SAFETY INTERVIEW FINDINGS:',
      `Language of Interview: ${language.toUpperCase()}`,
      `Coercion Detected: ${assessment?.coercion_detected ? 'YES - ACTIVE COERCION' : 'NO'}`,
      `Confidence Score: ${assessment ? Math.round(assessment.confidence * 100) : 0}%`,
      `Final Protective Action: ${assessment?.updated_decision || 'BLOCK'}`,
      '',
      'DETECTED COERCION INDICATORS:',
      ...(assessment?.coercion_indicators?.map((i) => ` - [CRITICAL] ${i}`) || ['None']),
      '',
      'SECURITY OFFICER ASSESSMENT:',
      assessment?.assessment || 'Transaction halted under suspicion of active digital extortion.',
      '----------------------------------------------------',
      'RECOMMENDED USER ACTIONS:',
      ' 1. Do NOT send money to this recipient identifier.',
      ' 2. Immediately call National Cyber Crime Helpline: 1930.',
      ' 3. Report the fraud handle at https://cybercrime.gov.in',
      ' 4. Disconnect any phone calls instructing you to transfer funds.',
      '====================================================',
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Guardian_Security_Report_${transactionId}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const suggestions = getContextualSuggestions(payment?.reason, language)

  return (
    <div className="coercion-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="coercion-modal-title">
      <div className="coercion-modal-backdrop" onClick={onClose} />
      <div className="coercion-modal">
        {/* Header */}
        <header className="coercion-modal__header">
          <div className="coercion-modal__title-group">
            <span className="coercion-modal__icon" aria-hidden="true">🛡️</span>
            <div>
              <h2 className="coercion-modal__title" id="coercion-modal-title">Guardian Coercion Interview</h2>
              <p className="coercion-modal__subtitle">
                {payment?.recipient ? `Reviewing transfer to ${payment.recipient}` : 'Active anti-extortion verification'}
              </p>
            </div>
          </div>

          <div className="coercion-modal__header-actions">
            {/* Language Switcher */}
            <div className="coercion-lang-picker" aria-label="Language options">
              <button
                type="button"
                className={`coercion-lang-btn ${language === 'en' ? 'coercion-lang-btn--active' : ''}`}
                onClick={() => setLanguage('en')}
                disabled={isLoading}
              >
                EN
              </button>
              <button
                type="button"
                className={`coercion-lang-btn ${language === 'hinglish' ? 'coercion-lang-btn--active' : ''}`}
                onClick={() => setLanguage('hinglish')}
                disabled={isLoading}
              >
                Hinglish
              </button>
              <button
                type="button"
                className={`coercion-lang-btn ${language === 'hi' ? 'coercion-lang-btn--active' : ''}`}
                onClick={() => setLanguage('hi')}
                disabled={isLoading}
              >
                हिंदी
              </button>
            </div>

            <span className="coercion-modal__turn-pill">
              {isComplete ? 'Complete' : `Turn ${turnsCompleted + 1} of 2`}
            </span>

            <button
              aria-label="Close interview dialog"
              className="coercion-modal__close-btn"
              onClick={onClose}
              type="button"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Live Risk Meter Bar */}
        <div className="coercion-risk-strip">
          <div className="coercion-risk-strip__label">
            <span>Interview Risk Assessment:</span>
            <strong className={liveRiskScore >= 75 ? 'coercion-risk-score--high' : 'coercion-risk-score--med'}>
              {liveRiskScore} / 100 {liveRiskScore >= 80 ? '• CRITICAL DANGER' : '• ELEVATED'}
            </strong>
          </div>
          <div className="coercion-risk-bar">
            <div
              className={`coercion-risk-bar__fill ${liveRiskScore >= 80 ? 'coercion-risk-bar__fill--danger' : 'coercion-risk-bar__fill--warning'}`}
              style={{ width: `${Math.min(100, liveRiskScore)}%` }}
            />
          </div>
        </div>

        {/* Message Stream */}
        <div className="coercion-modal__body">
          <div className="coercion-notice">
            <span aria-hidden="true">ℹ️</span>
            <span>
              {language === 'hi'
                ? 'गार्जियन ने उच्च-जोखिम धोखाधड़ी के संकेत पाए हैं। निष्पक्ष रूप से उत्तर दें ताकि हम आपके धन की सुरक्षा कर सकें।'
                : language === 'hinglish'
                ? 'Guardian ne scam signals detect kiye hain. Truthfully answer karein taaki aapke paise ko scam se bachaya ja sake.'
                : 'Payment Guardian detected scam manipulation signals. Answer truthfully so our agent can protect your funds.'}
            </span>
          </div>

          <div className="coercion-chat-stream">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`coercion-bubble coercion-bubble--${msg.sender}`}
              >
                <div className="coercion-bubble__meta">
                  <span className="coercion-bubble__sender">
                    {msg.sender === 'guardian' ? 'Guardian AI Safety Agent' : 'You (Aarav)'}
                  </span>
                  <span className="coercion-bubble__time">{msg.timestamp}</span>
                </div>
                <div className="coercion-bubble__text">{msg.text}</div>
              </div>
            ))}

            {isLoading && (
              <div className="coercion-bubble coercion-bubble--guardian coercion-bubble--loading">
                <span className="coercion-bubble__sender">Guardian AI</span>
                <div className="coercion-typing-indicator" aria-label="Guardian is analyzing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {/* Assessment Result Card */}
            {assessment && (
              <div
                className={`coercion-assessment-card ${
                  assessment.coercion_detected
                    ? 'coercion-assessment-card--danger'
                    : 'coercion-assessment-card--safe'
                }`}
              >
                <div className="coercion-assessment-card__header">
                  <div>
                    <h3 className="coercion-assessment-card__title">
                      {assessment.coercion_detected
                        ? '🚨 Third-Party Coercion Confirmed!'
                        : '✅ User Autonomy Confirmed'}
                    </h3>
                    <p className="coercion-assessment-card__conf">
                      Evaluation Confidence: {Math.round(assessment.confidence * 100)}%
                    </p>
                  </div>
                  <StatusBadge
                    label={assessment.updated_decision}
                    status={assessment.coercion_detected ? 'danger' : 'hold'}
                  />
                </div>

                <p className="coercion-assessment-card__text">{assessment.assessment}</p>

                {assessment.coercion_indicators && assessment.coercion_indicators.length > 0 && (
                  <div className="coercion-assessment-card__indicators">
                    <strong>Detected Social Engineering Indicators:</strong>
                    <ul>
                      {assessment.coercion_indicators.map((indicator, idx) => (
                        <li key={idx}>🚨 {indicator}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Savings Banner */}
                {assessment.coercion_detected && payment?.amount && (
                  <div className="coercion-savings-banner">
                    <span aria-hidden="true">🛡️</span>
                    <strong>₹{Number(payment.amount).toLocaleString('en-IN')} Scam Loss Intercepted & Prevented</strong>
                  </div>
                )}

                {/* Post-Interview Safety Actions */}
                <div className="coercion-assessment-card__actions">
                  {assessment.coercion_detected && (
                    <>
                      <Button
                        onClick={handleReportHelpline}
                        variant={reportedHelpline ? 'ghost' : 'secondary'}
                        disabled={reportedHelpline}
                      >
                        {reportedHelpline ? '✓ Reported to 1930 Helpline' : '🚨 Report to Cyber Helpline (1930)'}
                      </Button>
                      <Button onClick={handleDownloadReport} variant="secondary">
                        📥 Download Incident Report
                      </Button>
                    </>
                  )}
                  <Button onClick={onClose} variant="primary">
                    {assessment.coercion_detected ? 'Lock Payment & Close' : 'Return to Decision'}
                  </Button>
                </div>

                {reportedHelpline && (
                  <p className="coercion-report-confirm" role="status">
                    ✅ Disputed handle watchlist updated and incident report dispatched to Cyber Crime cell.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="coercion-error-banner" role="alert">
                <span>⚠️ {error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input & Quick Chips */}
        {!isComplete && (
          <footer className="coercion-modal__footer">
            {/* Quick Suggestions tailored to context */}
            <div className="coercion-chips" aria-label="Quick response suggestions">
              <span className="coercion-chips__label">
                {language === 'hi' ? 'त्वरित उत्तर चुनें:' : language === 'hinglish' ? 'Quick reply choose karein:' : 'Suggested quick replies:'}
              </span>
              <div className="coercion-chips__list">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className="coercion-chip-btn"
                    disabled={isLoading}
                    onClick={() => void handleSendAnswer(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Freeform input */}
            <form onSubmit={handleSubmit} className="coercion-input-bar">
              <input
                type="text"
                className="coercion-input-bar__input"
                placeholder={
                  language === 'hi'
                    ? 'यहाँ अपना उत्तर लिखें या ऊपर से सुझाव चुनें...'
                    : language === 'hinglish'
                    ? 'Apna answer yahan type karein ya upar se chip select karein...'
                    : 'Type your response or select a suggested answer above...'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isLoading}
                aria-label="Your response to Guardian"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!inputText.trim() || isLoading}
              >
                {isLoading ? '...' : language === 'hi' ? 'भेजें' : 'Send'}
              </Button>
            </form>
          </footer>
        )}
      </div>
    </div>
  )
}
