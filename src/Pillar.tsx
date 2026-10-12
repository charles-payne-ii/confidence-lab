import type { CSSProperties } from 'react'

export default function Pillar({ count, tierHeight = 20, onDark = false, highlightNewest = false }: { count: number; tierHeight?: number; onDark?: boolean; highlightNewest?: boolean }) {
  const n = Math.max(0, Math.min(10, Math.floor(count)))
  return <div className={`pillar ${onDark ? 'pillar-dark' : ''}`} role="img" aria-label={`${n} of 10 memories in your Confidence Bank`} style={{ '--tier-height': `${tierHeight}px` } as CSSProperties}>
    <span className="pillar-bar capital-one" /><span className="pillar-bar capital-two" /><span className="pillar-bar capital-three" />
    {Array.from({ length: 10 }, (_, i) => 10 - i).map((level) => <span key={level} data-level={level} className={`pillar-tier ${level <= n ? 'filled' : ''} ${highlightNewest && level === n ? 'newest' : ''}`} />)}
    <span className="pillar-bar base-three" /><span className="pillar-bar base-two" /><span className="pillar-bar base-one" />
  </div>
}
