'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CLASS_COLORS, CLASS_LABELS } from '@/lib/mockData';
import { DetectionList } from '@/components/DetectionList';
import DetectionCanvas from '@/components/DetectionCanvas';
import type { Detection } from '@/lib/types';
import { getScans } from '@/lib/store';

const ALL_CLASSES = ['shipwreck', 'pipe', 'cylinder', 'ghost_net'];

export default function ResultsPage() {
  const scans = getScans();
  const [selectedScan, setSelectedScan] = useState(scans[0]);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [activeClasses, setActiveClasses] = useState<Set<string>>(new Set());

  const allDetections: Detection[] = scans.flatMap(r => r.detections);

  const filteredDetections = useMemo(() => {
    if (!selectedScan) return [];
    return selectedScan.detections.filter(d =>
      d.confidence >= minConfidence &&
      (activeClasses.size === 0 || activeClasses.has(d.class))
    );
  }, [selectedScan, minConfidence, activeClasses]);

  const toggleClass = (cls: string) => {
    setActiveClasses(prev => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  // No analysis yet (e.g. direct navigation to /results)
  if (scans.length === 0) {
    return (
      <main className="page">
        <div className="container">
          <div className="page-header"><div className="page-header-inner">
            <div>
              <div className="page-breadcrumb">
                <Link href="/">EchoTrace</Link><span>›</span><span>Results</span>
              </div>
              <h1 style={{ fontSize: '2rem' }}>Detection Results</h1>
            </div>
          </div></div>
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📡</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.5rem' }}>No analysis yet</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Run the detection pipeline first — results will appear here.
            </div>
            <Link href="/analyze" className="btn btn-primary">🚀 Go to Analyze</Link>
          </div>
        </div>
      </main>
    );
  }

  const totalDetections = allDetections.length;
  const classCounts: Record<string, number> = {};
  for (const d of allDetections) {
    classCounts[d.class] = (classCounts[d.class] || 0) + 1;
  }

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div className="page-header-inner">
            <div>
              <div className="page-breadcrumb">
                <Link href="/">EchoTrace</Link>
                <span>›</span>
                <Link href="/analyze">Analyze</Link>
                <span>›</span>
                <span>Results</span>
              </div>
              <h1 style={{ fontSize: '2rem' }}>Detection Results</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
                {totalDetections} detections across {scans.length} sonar scans
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/report" className="btn btn-secondary">
                📋 View Full Report
              </Link>
              <Link href="/analyze" className="btn btn-ghost btn-sm">
                ← Run new scan
              </Link>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-label">Total Detections</div>
            <div className="stat-value" style={{ color: 'var(--sonar-cyan)' }}>{totalDetections}</div>
            <div className="stat-sub">across {scans.length} images</div>
          </div>
          {Object.entries(classCounts).map(([cls, count]) => (
            <div key={cls} className="stat-card">
              <div className="stat-label">{CLASS_LABELS[cls] ?? cls}</div>
              <div className="stat-value" style={{ color: CLASS_COLORS[cls] ?? 'var(--text-primary)' }}>
                {count}
              </div>
              <div className="stat-sub">detections</div>
            </div>
          ))}
          <div className="stat-card">
            <div className="stat-label">Avg Confidence</div>
            <div className="stat-value" style={{ color: 'var(--bio-green)' }}>
              {totalDetections > 0 ? (allDetections.reduce((s, d) => s + d.confidence, 0) / totalDetections * 100).toFixed(0) : 0}%
            </div>
            <div className="stat-sub">after shadow filter</div>
          </div>
        </div>

        {/* Scan selector */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {scans.map(r => (
            <button
              key={r.imageName}
              className={`chip ${selectedScan.imageName === r.imageName ? 'active' : ''}`}
              onClick={() => { setSelectedScan(r); setSelectedDetectionId(null); }}
            >
              <span className="chip-dot" style={{
                background: selectedScan.imageName === r.imageName ? 'var(--sonar-cyan)' : 'var(--text-muted)',
              }} />
              {r.imageName}
              <span style={{
                marginLeft: '0.25rem',
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                opacity: 0.7,
              }}>
                ({r.detections.length})
              </span>
            </button>
          ))}
        </div>

        <div className="results-layout">
          {/* Image viewer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="image-viewer">
              <div className="image-viewer-header">
                <div className="image-viewer-title">{selectedScan.imageName}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <span className="metric-pill">
                    {filteredDetections.length} shown
                  </span>
                  {selectedDetectionId && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedDetectionId(null)}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="image-canvas-wrap">
                <DetectionCanvas
                  imageSrc={selectedScan.imageDataUrl ?? null}
                  detections={selectedScan.detections}
                  selectedId={selectedDetectionId}
                  onSelectDetection={setSelectedDetectionId}
                  minConfidence={minConfidence}
                  activeClasses={activeClasses}
                />
              </div>
            </div>

            {/* Selected detection detail */}
            {selectedDetectionId && (() => {
              const d = selectedScan.detections.find(x => x.detection_id === selectedDetectionId);
              if (!d) return null;
              return (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                    Detection Detail
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    {[
                      { label: 'Class', value: CLASS_LABELS[d.class] ?? d.class },
                      { label: 'Confidence', value: `${(d.confidence * 100).toFixed(1)}%` },
                      { label: 'Raw Confidence', value: d.raw_confidence !== null && d.raw_confidence !== undefined ? `${(d.raw_confidence * 100).toFixed(1)}%` : '—' },
                      { label: 'Shadow ×', value: d.shadow_multiplier !== null && d.shadow_multiplier !== undefined ? d.shadow_multiplier.toFixed(3) : '—' },
                      { label: 'BBox', value: `[${d.bbox_px.join(', ')}]` },
                      { label: 'Geotag', value: typeof d.geotag === 'object' ? `${d.geotag.lat}, ${d.geotag.lon}` : 'N/A' },
                      { label: 'Detected', value: new Date(d.detected_at).toLocaleTimeString() },
                    ].map(item => (
                      <div key={item.label} style={{
                        padding: '0.75rem',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                          {item.label}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Detection list sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Filters */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h4 style={{ marginBottom: '0.875rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Filters
              </h4>
              <div style={{ marginBottom: '1rem' }}>
                <div className="slider-header" style={{ marginBottom: '0.4rem' }}>
                  <label className="slider-label">Min Confidence</label>
                  <span className="slider-val">{(minConfidence * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.95}
                  step={0.05}
                  value={minConfidence}
                  onChange={e => setMinConfidence(Number(e.target.value))}
                />
              </div>
              <div className="filter-chips">
                {ALL_CLASSES.map(cls => (
                  <button
                    key={cls}
                    className={`chip ${activeClasses.has(cls) ? 'active' : ''}`}
                    onClick={() => toggleClass(cls)}
                    style={activeClasses.has(cls) ? {
                      color: CLASS_COLORS[cls],
                      borderColor: CLASS_COLORS[cls],
                      background: CLASS_COLORS[cls] + '18',
                    } : {}}
                  >
                    <span className="chip-dot" style={{ background: CLASS_COLORS[cls] }} />
                    {CLASS_LABELS[cls]}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="card" style={{ padding: '1.25rem', flex: 1 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '0.875rem',
              }}>
                <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                  Detections
                </h4>
                <span className="metric-pill">{filteredDetections.length}</span>
              </div>
              <DetectionList
                detections={filteredDetections}
                selectedId={selectedDetectionId}
                onSelect={setSelectedDetectionId}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
