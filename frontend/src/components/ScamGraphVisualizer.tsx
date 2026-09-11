import { useState, useMemo } from 'react'
import type { GraphAnalysisResult, GraphNode } from '../types/guardian'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'

interface ScamGraphVisualizerProps {
  graphAnalysis?: GraphAnalysisResult
  recipientHandle?: string
  paymentAmount?: string
}

interface NodePosition {
  x: number
  y: number
}

export function ScamGraphVisualizer({
  graphAnalysis,
  recipientHandle = 'Recipient',
  paymentAmount = '₹25,000',
}: ScamGraphVisualizerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<'all' | 'threats' | 'flow'>('all')

  const network = graphAnalysis?.network_graph
  const nodes = network?.nodes ?? []
  const edges = network?.edges ?? []
  const muleMetrics = network?.mule_metrics
  const collectiveIntel = network?.collective_intelligence

  const isMuleHub = graphAnalysis?.is_hub_recipient || graphAnalysis?.user_graph_risk === 'HUB_MULE_PATTERN' || graphAnalysis?.user_graph_risk === 'FLAGGED_RECIPIENT'

  // Dynamic layout positioning for nodes in a clean 840x440 coordinate space
  const nodePositions = useMemo(() => {
    const positions: Record<string, NodePosition> = {}
    const coVictims = nodes.filter((n) => n.type === 'CO_VICTIM')
    const mules = nodes.filter((n) => n.type === 'MULE_HUB')
    const safeContacts = nodes.filter((n) => n.type === 'SAFE_CONTACT')

    // 1. User Position (Center Left)
    const userNode = nodes.find((n) => n.type === 'USER')
    if (userNode) {
      positions[userNode.id] = { x: 130, y: 220 }
    }

    // 2. Co-Victims (Spread along top/bottom left)
    coVictims.forEach((cv, idx) => {
      const yCoords = [75, 340, 140, 290]
      const xCoords = [90, 90, 50, 50]
      positions[cv.id] = {
        x: xCoords[idx % xCoords.length] ?? 70,
        y: yCoords[idx % yCoords.length] ?? (80 + idx * 80),
      }
    })

    // 3. Recipient Node (Prominent Center)
    const recipientNode = nodes.find((n) => n.type === 'RECIPIENT')
    if (recipientNode) {
      positions[recipientNode.id] = { x: 420, y: 220 }
    }

    // 4. Safe Contacts (if safe transaction)
    safeContacts.forEach((sc, idx) => {
      const yCoords = [110, 330]
      positions[sc.id] = { x: 420, y: yCoords[idx % yCoords.length] ?? 200 }
    })

    // 5. Mule Hub & Cashout Nodes (Right side fan-out)
    mules.forEach((mule, idx) => {
      if (idx === 0) {
        positions[mule.id] = { x: 640, y: 160 }
      } else if (idx === 1) {
        positions[mule.id] = { x: 740, y: 280 }
      } else {
        positions[mule.id] = { x: 670, y: 350 }
      }
    })

    // Fallback for any unmapped nodes
    nodes.forEach((node, i) => {
      if (!positions[node.id]) {
        positions[node.id] = { x: 200 + (i * 120) % 500, y: 150 + (i * 60) % 200 }
      }
    })

    return positions
  }, [nodes])

  // Active selected node or default to target recipient
  const activeNode = useMemo(() => {
    if (selectedNodeId) {
      return nodes.find((n) => n.id === selectedNodeId) ?? null
    }
    // Default to recipient if available, otherwise first node
    return nodes.find((n) => n.type === 'RECIPIENT') ?? nodes[0] ?? null
  }, [selectedNodeId, nodes])

  // Filter edges based on filter mode
  const visibleEdges = useMemo(() => {
    if (filterMode === 'threats') {
      return edges.filter((e) => e.tone === 'danger' || e.status === 'MULE_HOP' || e.status === 'REPORTED')
    }
    if (filterMode === 'flow') {
      return edges.filter((e) => e.status === 'PENDING_HOLD' || e.status === 'MULE_HOP')
    }
    return edges
  }, [edges, filterMode])

  const getNodeColor = (node: GraphNode) => {
    switch (node.type) {
      case 'USER':
        return { fill: '#0284c7', stroke: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' }
      case 'RECIPIENT':
        return node.risk_level === 'CRITICAL' || node.risk_level === 'HIGH'
          ? { fill: '#dc2626', stroke: '#f87171', glow: 'rgba(239, 68, 68, 0.5)' }
          : { fill: '#16a34a', stroke: '#4ade80', glow: 'rgba(74, 222, 128, 0.4)' }
      case 'MULE_HUB':
        return { fill: '#991b1b', stroke: '#fca5a5', glow: 'rgba(239, 68, 68, 0.6)' }
      case 'CO_VICTIM':
        return { fill: '#d97706', stroke: '#fbbf24', glow: 'rgba(245, 158, 11, 0.4)' }
      case 'SAFE_CONTACT':
        return { fill: '#059669', stroke: '#34d399', glow: 'rgba(52, 211, 153, 0.4)' }
      default:
        return { fill: '#475569', stroke: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)' }
    }
  }

  const getNodeIcon = (node: GraphNode) => {
    switch (node.type) {
      case 'USER':
        return '👤'
      case 'RECIPIENT':
        return node.risk_level === 'CRITICAL' || node.risk_level === 'HIGH' ? '⚠️' : '✓'
      case 'MULE_HUB':
        return '🕷️'
      case 'CO_VICTIM':
        return '👥'
      case 'SAFE_CONTACT':
        return '🛡️'
      default:
        return '⚪'
    }
  }

  return (
    <Card className="scam-graph-card">
      {/* 1. Header & Controls */}
      <div className="scam-graph-header">
        <div>
          <div className="scam-graph-header__badge-row">
            <span className="guardian-panel__eyebrow">Graph Fraud Network &amp; Collective Intel</span>
            {isMuleHub ? (
              <Badge tone="danger" className="scam-graph-header__pill">
                Mule Ring Detected
              </Badge>
            ) : (
              <Badge tone="success" className="scam-graph-header__pill">
                Clean Topology
              </Badge>
            )}
          </div>
          <h2 className="guardian-panel__title">Real-Time Scam Network Analysis</h2>
          <p className="scam-graph-header__subtitle">
            {graphAnalysis?.summary || 'Interactive payment graph mapping recipient fan-in velocity and mule clusters.'}
          </p>
        </div>

        {/* Filters */}
        <div className="scam-graph-controls">
          <div className="scam-graph-filters" role="group" aria-label="Graph filter options">
            <button
              type="button"
              className={`scam-graph-filter-btn ${filterMode === 'all' ? 'scam-graph-filter-btn--active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              Full Graph ({nodes.length})
            </button>
            <button
              type="button"
              className={`scam-graph-filter-btn ${filterMode === 'threats' ? 'scam-graph-filter-btn--active' : ''}`}
              onClick={() => setFilterMode('threats')}
            >
              Threats Only
            </button>
            <button
              type="button"
              className={`scam-graph-filter-btn ${filterMode === 'flow' ? 'scam-graph-filter-btn--active' : ''}`}
              onClick={() => setFilterMode('flow')}
            >
              Laundering Flow
            </button>
          </div>
        </div>
      </div>

      {/* 2. Collective Threat Intelligence Banner */}
      {collectiveIntel && (
        <div className={`collective-intel-banner ${collectiveIntel.community_reports_count > 0 ? 'collective-intel-banner--threat' : 'collective-intel-banner--safe'}`}>
          <div className="collective-intel-banner__metric">
            <span className="collective-intel-banner__icon">🏛️</span>
            <div>
              <span className="collective-intel-banner__label">1930 / I4C Portal Sync</span>
              <span className="collective-intel-banner__value">{collectiveIntel.national_cybercrime_status}</span>
            </div>
          </div>

          <div className="collective-intel-banner__divider" />

          <div className="collective-intel-banner__metric">
            <span className="collective-intel-banner__icon">🚨</span>
            <div>
              <span className="collective-intel-banner__label">Citizen Fraud Reports</span>
              <span className="collective-intel-banner__value">
                {collectiveIntel.community_reports_count > 0
                  ? `${collectiveIntel.community_reports_count} Active Disputes (Last 48h)`
                  : '0 Reports Filed'}
              </span>
            </div>
          </div>

          <div className="collective-intel-banner__divider" />

          <div className="collective-intel-banner__metric">
            <span className="collective-intel-banner__icon">📊</span>
            <div>
              <span className="collective-intel-banner__label">Reputation Trust Score</span>
              <span className="collective-intel-banner__value">
                {collectiveIntel.reputation_score}/100 ({collectiveIntel.reputation_score < 30 ? 'CRITICAL DEFICIT' : 'HEALTHY'})
              </span>
            </div>
          </div>

          {muleMetrics?.cluster_name && (
            <>
              <div className="collective-intel-banner__divider" />
              <div className="collective-intel-banner__metric">
                <span className="collective-intel-banner__icon">🔗</span>
                <div>
                  <span className="collective-intel-banner__label">Mule Syndicate Cluster</span>
                  <span className="collective-intel-banner__value">{muleMetrics.cluster_name}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. Interactive SVG Graph Canvas & Forensics Split */}
      <div className="scam-graph-layout">
        {/* SVG Canvas */}
        <div className="scam-graph-canvas-container">
          <svg
            className="scam-graph-svg"
            viewBox="0 0 840 440"
            role="img"
            aria-label="Payment network and money mule graph visualization"
          >
            <defs>
              {/* Arrow markers for edges */}
              <marker id="arrow-danger" markerWidth="8" markerHeight="8" refX="24" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#ef4444" />
              </marker>
              <marker id="arrow-success" markerWidth="8" markerHeight="8" refX="24" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#22c55e" />
              </marker>
              <marker id="arrow-warning" markerWidth="8" markerHeight="8" refX="24" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#f59e0b" />
              </marker>
              <marker id="arrow-neutral" markerWidth="8" markerHeight="8" refX="24" refY="4" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 Z" fill="#94a3b8" />
              </marker>

              {/* Node drop shadows */}
              <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Background Grid Accent */}
            <g className="scam-graph-bg-grid" opacity="0.15">
              {Array.from({ length: 9 }).map((_, i) => (
                <line key={`vline-${i}`} x1={i * 105} y1="0" x2={i * 105} y2="440" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
              ))}
              {Array.from({ length: 5 }).map((_, i) => (
                <line key={`hline-${i}`} x1="0" y1={i * 110} x2="840" y2={i * 110} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
              ))}
            </g>

            {/* Edge Connections */}
            <g className="scam-graph-edges">
              {visibleEdges.map((edge) => {
                const sourcePos = nodePositions[edge.source]
                const targetPos = nodePositions[edge.target]
                if (!sourcePos || !targetPos) return null

                const isDanger = edge.tone === 'danger'
                const isSuccess = edge.tone === 'success'
                const strokeColor = isDanger ? '#ef4444' : isSuccess ? '#22c55e' : '#64748b'
                const markerId = isDanger ? 'arrow-danger' : isSuccess ? 'arrow-success' : 'arrow-neutral'

                // Curved cubic bezier path
                const midX = (sourcePos.x + targetPos.x) / 2
                const midY = (sourcePos.y + targetPos.y) / 2 - (sourcePos.y !== targetPos.y ? 15 : 0)
                const pathD = `M ${sourcePos.x} ${sourcePos.y} Q ${midX} ${midY} ${targetPos.x} ${targetPos.y}`

                return (
                  <g key={edge.id} className="scam-graph-edge-group">
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={edge.animated ? 2.5 : 1.75}
                      strokeDasharray={edge.animated ? '6 4' : undefined}
                      className={edge.animated ? 'scam-graph-edge--animated' : ''}
                      markerEnd={`url(#${markerId})`}
                      opacity={0.85}
                    />
                    {/* Edge Label */}
                    <text
                      x={midX}
                      y={midY - 6}
                      fill={strokeColor}
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                      className="scam-graph-edge-label"
                    >
                      {edge.label}
                    </text>
                  </g>
                )
              })}
            </g>

            {/* Nodes */}
            <g className="scam-graph-nodes">
              {nodes.map((node) => {
                const pos = nodePositions[node.id]
                if (!pos) return null

                const isSelected = activeNode?.id === node.id
                const colors = getNodeColor(node)
                const isRecipient = node.type === 'RECIPIENT'
                const nodeRadius = isRecipient ? 30 : 22

                return (
                  <g
                    key={node.id}
                    className={`scam-graph-node ${isSelected ? 'scam-graph-node--selected' : ''}`}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Node: ${node.label} (${node.type})`}
                  >
                    {/* Selected Halo */}
                    {isSelected && (
                      <circle
                        r={nodeRadius + 10}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        className="scam-graph-node__halo"
                      />
                    )}

                    {/* Outer Glow Ring */}
                    <circle
                      r={nodeRadius + 4}
                      fill={colors.glow}
                      className={node.risk_level === 'CRITICAL' ? 'scam-graph-node__pulse' : ''}
                    />

                    {/* Main Node Circle */}
                    <circle
                      r={nodeRadius}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth="2.5"
                      className="scam-graph-node__body"
                    />

                    {/* Icon inside Node */}
                    <text
                      y={isRecipient ? 4 : 3}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={isRecipient ? '16' : '12'}
                      fill="#ffffff"
                    >
                      {getNodeIcon(node)}
                    </text>

                    {/* Label below node */}
                    <text
                      y={nodeRadius + 16}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="11"
                      fontWeight="600"
                      className="scam-graph-node-text"
                    >
                      {node.label.length > 20 ? `${node.label.slice(0, 18)}...` : node.label}
                    </text>

                    {/* Badge / Subtitle */}
                    {node.badge && (
                      <text
                        y={nodeRadius + 28}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="9"
                        fontWeight="500"
                        className="scam-graph-node-badge"
                      >
                        {node.badge}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Graph Legend & Status */}
          <div className="scam-graph-legend">
            <span className="scam-graph-legend-item">
              <span className="scam-graph-legend-dot scam-graph-legend-dot--user" /> Aarav (You)
            </span>
            <span className="scam-graph-legend-item">
              <span className="scam-graph-legend-dot scam-graph-legend-dot--target" /> Target Payee
            </span>
            <span className="scam-graph-legend-item">
              <span className="scam-graph-legend-dot scam-graph-legend-dot--victim" /> Co-Victim
            </span>
            <span className="scam-graph-legend-item">
              <span className="scam-graph-legend-dot scam-graph-legend-dot--mule" /> Money Mule Hub
            </span>
          </div>
        </div>

        {/* Forensics Node Inspector Card */}
        <div className="scam-graph-inspector">
          {activeNode ? (
            <div className="node-forensics-card">
              <div className="node-forensics-card__header">
                <div>
                  <span className="node-forensics-card__type-badge">
                    {activeNode.type.replace('_', ' ')}
                  </span>
                  <h3 className="node-forensics-card__title">{activeNode.label}</h3>
                  <p className="node-forensics-card__subtitle">{activeNode.subtitle ?? activeNode.id}</p>
                </div>
                <Badge
                  tone={
                    activeNode.risk_level === 'CRITICAL'
                      ? 'danger'
                      : activeNode.risk_level === 'HIGH'
                      ? 'danger'
                      : activeNode.risk_level === 'MEDIUM'
                      ? 'warning'
                      : 'success'
                  }
                >
                  {activeNode.risk_level} RISK
                </Badge>
              </div>

              <div className="node-forensics-card__body">
                <div className="node-forensics-card__row">
                  <span className="node-forensics-card__label">UPI / Node Handle</span>
                  <span className="node-forensics-card__value node-forensics-card__value--mono">
                    {activeNode.id}
                  </span>
                </div>

                {activeNode.amount && (
                  <div className="node-forensics-card__row">
                    <span className="node-forensics-card__label">Amount Defrauded</span>
                    <span className="node-forensics-card__value text-danger font-bold">
                      {activeNode.amount}
                    </span>
                  </div>
                )}

                <div className="node-forensics-card__row">
                  <span className="node-forensics-card__label">Network Classification</span>
                  <span className="node-forensics-card__value">
                    {activeNode.type === 'MULE_HUB'
                      ? 'Layer 2 Mule Dispersal Hub'
                      : activeNode.type === 'RECIPIENT'
                      ? (isMuleHub ? 'Flagged Syndicate Mule Sink' : 'Standard Verified Beneficiary')
                      : activeNode.type === 'CO_VICTIM'
                      ? 'Identified Co-Victim (Recent Transfer)'
                      : 'Sender (Verified KYC)'}
                  </span>
                </div>

                <div className="node-forensics-card__row">
                  <span className="node-forensics-card__label">Dispute / CyberCell Status</span>
                  <span className="node-forensics-card__value">
                    {activeNode.type === 'RECIPIENT' && collectiveIntel?.community_reports_count
                      ? `${collectiveIntel.community_reports_count} reports on 1930 / I4C`
                      : activeNode.type === 'CO_VICTIM'
                      ? 'Complaint lodged on 1930 Helpline'
                      : activeNode.type === 'MULE_HUB'
                      ? 'Under Police CyberCell Monitoring'
                      : '0 Reports / Verified'}
                  </span>
                </div>

                {activeNode.type === 'RECIPIENT' && (
                  <div className="node-forensics-card__metric-box">
                    <div className="node-forensics-card__metric-item">
                      <span className="node-forensics-card__metric-label">Fan-In Senders</span>
                      <span className="node-forensics-card__metric-num">{muleMetrics?.fan_in_count ?? 0}</span>
                    </div>
                    <div className="node-forensics-card__metric-item">
                      <span className="node-forensics-card__metric-label">Mule Probability</span>
                      <span className="node-forensics-card__metric-num text-danger">
                        {muleMetrics?.mule_probability ?? 0}%
                      </span>
                    </div>
                    <div className="node-forensics-card__metric-item">
                      <span className="node-forensics-card__metric-label">Laundering Depth</span>
                      <span className="node-forensics-card__metric-num">L{muleMetrics?.layer_depth ?? 1}</span>
                    </div>
                  </div>
                )}

                {/* Guardian Recommended Countermeasure */}
                <div className="node-forensics-card__recommendation">
                  <span className="node-forensics-card__rec-title">🛡️ Guardian Automated Action:</span>
                  <p className="node-forensics-card__rec-text">
                    {activeNode.risk_level === 'CRITICAL' || activeNode.risk_level === 'HIGH'
                      ? `Freeze payment flow of ${paymentAmount} to ${recipientHandle}. Report VPA to National Cyber Crime Reporting Portal (1930) and flag downstream mule rings.`
                      : 'Clear transaction through trusted channel. No graph-level anomalies or syndicate linkages detected.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="node-forensics-card node-forensics-card--empty">
              <p>Click any node in the graph to inspect forensic intelligence, dispute logs, and mule linkages.</p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Risk Propagation Stepper */}
      {collectiveIntel?.risk_propagation_path && collectiveIntel.risk_propagation_path.length > 1 && (
        <div className="scam-graph-stepper-container">
          <span className="scam-graph-stepper__label">Scam Risk Propagation Pathway:</span>
          <div className="scam-graph-stepper">
            {collectiveIntel.risk_propagation_path.map((hop, index) => (
              <div key={hop} className="scam-graph-step">
                <span className="scam-graph-step__num">Hop 0{index + 1}</span>
                <span className="scam-graph-step__name">{hop}</span>
                {index < collectiveIntel.risk_propagation_path.length - 1 && (
                  <span className="scam-graph-step__arrow">➔</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
