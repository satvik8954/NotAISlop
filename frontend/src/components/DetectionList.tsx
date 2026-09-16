import type { Detection } from '@/lib/types';
import { CLASS_COLORS, CLASS_LABELS } from '@/lib/mockData';

interface ConfidenceBarProps {
  value: number;
  rawValue?: number;
  showRaw?: boolean;
}

export function ConfidenceBar({ value, rawValue, showRaw }: ConfidenceBarProps) {
  const pct = Math.round(value * 100);
  const color = value >= 0.9 ? 'var(--bio-green)'
    : value >= 0.7 ? 'var(--sonar-cyan)'
    : value >= 0.5 ? 'var(--amber)'
    : 'var(--coral)';

  return (
    <div className="confidence-bar-wrap">
      <div className="confidence-bar-track">
        <div
          className="confidence-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="confidence-value" style={{ color }}>
        {pct}%
        {showRaw && rawValue !== undefined && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginLeft: '0.3rem' }}>
            ({Math.round(rawValue * 100)}%)
          </span>
        )}
      </div>
    </div>
  );
}

interface ClassBadgeProps {
  cls: string;
}

export function ClassBadge({ cls }: ClassBadgeProps) {
  return (
    <span className={`class-badge ${cls}`}>
      {CLASS_LABELS[cls] ?? cls}
    </span>
  );
}

interface DetectionListProps {
  detections: Detection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DetectionList({ detections, selectedId, onSelect }: DetectionListProps) {
  if (detections.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '2rem' }}>
        <div className="empty-icon" style={{ fontSize: '2rem' }}>🔍</div>
        <div className="empty-title" style={{ fontSize: '0.9rem' }}>No detections match filters</div>
      </div>
    );
  }

  return (
    <div className="detection-list">
      {detections.map(d => (
        <div
          key={d.detection_id}
          className={`detection-item ${selectedId === d.detection_id ? 'selected' : ''}`}
          onClick={() => onSelect(d.detection_id === selectedId ? '' : d.detection_id)}
        >
          <div className="detection-item-header">
            <ClassBadge cls={d.class} />
            <div className="shadow-chip">
              shadow ×{d.shadow_multiplier?.toFixed(3) ?? '—'}
            </div>
          </div>
          <ConfidenceBar value={d.confidence} rawValue={d.raw_confidence ?? undefined} showRaw />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="detection-id">{d.detection_id}</div>
            <div style={{
              fontSize: '0.68rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
            }}>
              [{d.bbox_px[0]},{d.bbox_px[1]}]→[{d.bbox_px[2]},{d.bbox_px[3]}]
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
