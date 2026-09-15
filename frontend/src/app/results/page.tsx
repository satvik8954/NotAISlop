'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { MOCK_SCAN_RESULTS, CLASS_COLORS, CLASS_LABELS } from '@/lib/mockData';
import { DetectionList } from '@/components/DetectionList';
import DetectionCanvas from '@/components/DetectionCanvas';
import type { Detection } from '@/lib/types';

const ALL_CLASSES = ['shipwreck', 'pipe', 'cylinder', 'ghost_net'];

// Synthetically generated sonar-like placeholder images
const PLACEHOLDER_IMAGES: Record<string, string> = {
  'Corsair_01.png': '/api/placeholder/corsair',
  'Monrovia_02.png': '/api/placeholder/monrovia',
  '1693569523.810.png': '/api/placeholder/pipe',
  '0003_2021.png': '/api/placeholder/cylinder',
};

export default function ResultsPage() {
  const [selectedScan, setSelectedScan] = useState(MOCK_SCAN_RESULTS[0]);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [activeClasses, setActiveClasses] = useState<Set<string>>(new Set());

  const allDetections: Detection[] = MOCK_SCAN_RESULTS.flatMap(r => r.detections);

  const filteredDetections = useMemo(() => {
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

  const totalDetections = MOCK_SCAN_RESULTS.reduce((s, r) => s + r.detections.length, 0);
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
                {totalDetections} detections across {MOCK_SCAN_RESULTS.length} sonar scans
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
            <div className="stat-sub">across {MOCK_SCAN_RESULTS.length} images</div>
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
              {(allDetections.reduce((s, d) => s + d.confidence, 0) / allDetections.length * 100).toFixed(0)}%
            </div>
            <div className="stat-sub">after shadow filter</div>
          </div>
        </div>

        {/* Scan selector */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {MOCK_SCAN_RESULTS.map(r => (
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
                <SonarImageCanvas
                  imageName={selectedScan.imageName}
                  detections={filteredDetections}
                  selectedId={selectedDetectionId}
                  onSelect={setSelectedDetectionId}
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
                      { label: 'Raw Confidence', value: `${(d.raw_confidence * 100).toFixed(1)}%` },
                      { label: 'Shadow ×', value: d.shadow_multiplier.toFixed(3) },
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

// Canvas component that generates a synthetic sonar-like background
function SonarImageCanvas({
  imageName,
  detections,
  selectedId,
  onSelect,
}: {
  imageName: string;
  detections: Detection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useState<HTMLCanvasElement | null>(null);

  // Use a synthetic sonar-like pattern as background
  return (
    <SonarCanvas
      key={imageName}
      imageName={imageName}
      detections={detections}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}

// Generates synthetic sonar scan with detection overlays
function SonarCanvas({
  imageName,
  detections,
  selectedId,
  onSelect,
}: {
  imageName: string;
  detections: Detection[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useState<HTMLCanvasElement | null>(null);

  const refCallback = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 800, H = 400;
    canvas.width = W;
    canvas.height = H;

    // Background: dark water column
    ctx.fillStyle = '#08111a';
    ctx.fillRect(0, 0, W, H);

    // Nadir (center dark strip)
    const nadirGrad = ctx.createLinearGradient(W * 0.35, 0, W * 0.65, 0);
    nadirGrad.addColorStop(0, 'transparent');
    nadirGrad.addColorStop(0.5, 'rgba(0,0,0,0.8)');
    nadirGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = nadirGrad;
    ctx.fillRect(0, 0, W, H);

    // Sonar texture: random noise-like columns
    const seed = imageName.charCodeAt(0) * 31 + imageName.charCodeAt(1) * 17;
    for (let x = 0; x < W; x += 2) {
      for (let y = 0; y < H; y += 2) {
        const n = pseudoRandom(x + seed, y + seed * 2);
        const distFromCenter = Math.abs(x - W / 2) / (W / 2);
        const intensity = n * (0.3 + distFromCenter * 0.5);
        const v = Math.floor(intensity * 100);
        ctx.fillStyle = `rgba(${v * 0.6 | 0}, ${v | 0}, ${v * 0.8 | 0}, 0.7)`;
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Horizontal scan lines
    for (let y = 0; y < H; y += 4) {
      ctx.strokeStyle = `rgba(0, 180, 220, ${0.03 + pseudoRandom(0, y) * 0.04})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Draw detections scaled to canvas size
    // Find bbox bounds for this image to scale relative to it
    if (detections.length === 0) return;
    const maxX = Math.max(...detections.map(d => d.bbox_px[2]));
    const maxY = Math.max(...detections.map(d => d.bbox_px[3]));
    const imgW = Math.max(maxX + 256, 1500);
    const imgH = Math.max(maxY + 256, 1800);
    const sx = W / imgW;
    const sy = H / imgH;

    for (const d of detections) {
      const [x1, y1, x2, y2] = d.bbox_px;
      const rx1 = x1 * sx, ry1 = y1 * sy;
      const rw = (x2 - x1) * sx, rh = (y2 - y1) * sy;
      const color = CLASS_COLORS[d.class] ?? '#fff';
      const isSelected = d.detection_id === selectedId;

      // Shadow simulation
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(rx1, ry1 + rh, rw, rh * 0.5);

      // Object highlight
      const hlGrad = ctx.createLinearGradient(rx1, ry1, rx1 + rw, ry1 + rh);
      hlGrad.addColorStop(0, color + '40');
      hlGrad.addColorStop(1, color + '15');
      ctx.fillStyle = hlGrad;
      ctx.fillRect(rx1, ry1, rw, rh);

      // Border
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 18 : 6;
      ctx.strokeStyle = color + (isSelected ? 'ff' : '99');
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeRect(rx1 + 1, ry1 + 1, rw - 2, rh - 2);
      ctx.shadowBlur = 0;

      // Label
      const label = `${CLASS_LABELS[d.class] ?? d.class} ${(d.confidence * 100).toFixed(0)}%`;
      ctx.font = `bold ${isSelected ? 12 : 10}px "Space Mono", monospace`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(rx1, Math.max(0, ry1 - 17), tw + 10, 17);
      ctx.fillStyle = '#000';
      ctx.fillText(label, rx1 + 5, Math.max(13, ry1 - 3));
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (detections.length === 0) return;
    const maxX = Math.max(...detections.map(d => d.bbox_px[2]));
    const maxY = Math.max(...detections.map(d => d.bbox_px[3]));
    const imgW = Math.max(maxX + 256, 1500);
    const imgH = Math.max(maxY + 256, 1800);
    const sx = canvas.width / imgW;
    const sy = canvas.height / imgH;

    for (const d of [...detections].reverse()) {
      const [x1, y1, x2, y2] = d.bbox_px;
      if (mx >= x1 * sx && mx <= x2 * sx && my >= y1 * sy && my <= y2 * sy) {
        onSelect(d.detection_id === selectedId ? '' : d.detection_id);
        return;
      }
    }
    onSelect('');
  };

  return (
    <canvas
      ref={refCallback}
      onClick={handleClick}
      style={{ maxWidth: '100%', cursor: 'crosshair', display: 'block' }}
    />
  );
}

function pseudoRandom(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
