'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { CLASS_COLORS, CLASS_LABELS, computeStats } from '@/lib/mockData';
import { ClassBadge, ConfidenceBar } from '@/components/DetectionList';
import type { Detection } from '@/lib/types';
import { getScans } from '@/lib/store';

type SortKey = 'confidence' | 'class' | 'shadow_multiplier' | 'detected_at';
type SortDir = 'asc' | 'desc';

export default function ReportPage() {
  const scans = getScans();
  const allDetections: Detection[] = scans.flatMap(s => s.detections);

  const [sortKey, setSortKey] = useState<SortKey>('confidence');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [minConf, setMinConf] = useState(0);

  const stats = useMemo(() => computeStats(allDetections), [allDetections]);

  const sorted = useMemo(() => {
    let list = allDetections.filter(d =>
      d.confidence >= minConf &&
      (filterClass === 'all' || d.class === filterClass)
    );

    list.sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortKey === 'confidence') { av = a.confidence; bv = b.confidence; }
      else if (sortKey === 'shadow_multiplier') { av = a.shadow_multiplier ?? 0; bv = b.shadow_multiplier ?? 0; }
      else if (sortKey === 'class') { av = a.class; bv = b.class; }
      else { av = a.detected_at; bv = b.detected_at; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [allDetections, sortKey, sortDir, filterClass, minConf]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortIcon = (key: SortKey) =>
    sortKey !== key ? ' ↕' : sortDir === 'desc' ? ' ↓' : ' ↑';

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(sorted, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'echotrace_detections.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const headers = ['detection_id', 'source_image', 'class', 'confidence', 'raw_confidence', 'shadow_multiplier', 'bbox_x1', 'bbox_y1', 'bbox_x2', 'bbox_y2', 'geotag', 'detected_at'];
    const rows = sorted.map(d => [
      d.detection_id,
      d.source_image,
      d.class,
      d.confidence,
      d.raw_confidence ?? '',
      d.shadow_multiplier ?? '',
      ...d.bbox_px,
      typeof d.geotag === 'object' ? `${d.geotag.lat},${d.geotag.lon}` : d.geotag,
      d.detected_at,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'echotrace_detections.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const confDistribution = useMemo(() => {
    const bins = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
    for (const d of allDetections) {
      const bin = Math.min(4, Math.floor(d.confidence * 5));
      bins[bin]++;
    }
    return bins;
  }, [allDetections]);

  const maxBin = Math.max(...confDistribution, 1);

  if (allDetections.length === 0 && scans.length === 0) {
    return (
      <main className="page">
        <div className="container">
          <div className="page-header"><div className="page-header-inner">
            <div>
              <div className="page-breadcrumb">
                <Link href="/">EchoTrace</Link><span>›</span><span>Report</span>
              </div>
              <h1 style={{ fontSize: '2rem' }}>Detection Report</h1>
            </div>
          </div></div>
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.5rem' }}>No report yet</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Run the detection pipeline first — the structured report is generated from its output.
            </div>
            <Link href="/analyze" className="btn btn-primary">🚀 Go to Analyze</Link>
          </div>
        </div>
      </main>
    );
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
                <span>Report</span>
              </div>
              <h1 style={{ fontSize: '2rem' }}>Detection Report</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
                Structured geotagged output from the live EchoTrace pipeline run
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={exportCSV}>
                ⬇ Export CSV
              </button>
              <button className="btn btn-primary" onClick={exportJSON}>
                ⬇ Export JSON
              </button>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-label">Total Detections</div>
            <div className="stat-value" style={{ color: 'var(--sonar-cyan)' }}>{stats.total}</div>
            <div className="stat-sub">across {scans.length} scans</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Confidence</div>
            <div className="stat-value" style={{ color: 'var(--bio-green)' }}>
              {(stats.avgConfidence * 100).toFixed(1)}%
            </div>
            <div className="stat-sub">post shadow filter</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">High Confidence</div>
            <div className="stat-value" style={{ color: 'var(--bio-green)' }}>{stats.highConfidence}</div>
            <div className="stat-sub">≥ 90% confidence</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Low Confidence</div>
            <div className="stat-value" style={{ color: 'var(--coral)' }}>{stats.lowConfidence}</div>
            <div className="stat-sub">&lt; 70% confidence</div>
          </div>
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Confidence histogram */}
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Confidence Distribution
            </h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: 100 }}>
              {['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'].map((label, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem', height: '100%' }}>
                  <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${maxBin > 0 ? (confDistribution[i] / maxBin) * 100 : 0}%`,
                        minHeight: confDistribution[i] > 0 ? 4 : 0,
                        background: i === 4 ? 'var(--bio-green)' : i === 3 ? 'var(--sonar-cyan)' : i === 2 ? 'var(--amber)' : 'var(--coral)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.4s ease',
                        opacity: 0.85,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                    {confDistribution[i]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Class breakdown */}
          <div className="card">
            <h3 style={{ marginBottom: '1.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              Class Breakdown
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(stats.byClass).map(([cls, count]) => (
                <div key={cls}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <ClassBadge cls={cls} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {count} ({stats.total > 0 ? ((count / stats.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                  <div className="confidence-bar-track">
                    <div
                      className="confidence-bar-fill"
                      style={{
                        width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`,
                        background: CLASS_COLORS[cls] ?? 'var(--sonar-cyan)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Per-scan summary */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            Per-Scan Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {scans.map(scan => {
              const sc = computeStats(scan.detections);
              return (
                <div key={scan.imageName} style={{
                  padding: '1rem',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--sonar-cyan)', marginBottom: '0.625rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scan.imageName}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
                    {sc.total}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>detections</div>
                  <ConfidenceBar value={sc.avgConfidence} />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>avg confidence</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['all', 'shipwreck', 'pipe', 'cylinder'].map(cls => (
              <button
                key={cls}
                className={`chip ${filterClass === cls ? 'active' : ''}`}
                onClick={() => setFilterClass(cls)}
                style={filterClass === cls && cls !== 'all' ? {
                  color: CLASS_COLORS[cls],
                  borderColor: CLASS_COLORS[cls],
                  background: CLASS_COLORS[cls] + '18',
                } : {}}
              >
                {cls === 'all' ? 'All Classes' : CLASS_LABELS[cls]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginLeft: 'auto' }}>
            <label className="slider-label">Min conf:</label>
            <input
              type="range" min={0} max={0.9} step={0.05} value={minConf}
              onChange={e => setMinConf(Number(e.target.value))}
              style={{ width: 100 }}
            />
            <span className="slider-val">{(minConf * 100).toFixed(0)}%</span>
          </div>
          <span className="metric-pill">{sorted.length} rows</span>
        </div>

        {/* Data table */}
        <div className="data-table-wrap" style={{ marginBottom: '2rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('class')}>
                  Class{sortIcon('class')}
                </th>
                <th>ID</th>
                <th>Source</th>
                <th onClick={() => handleSort('confidence')}>
                  Confidence{sortIcon('confidence')}
                </th>
                <th>Raw Conf.</th>
                <th onClick={() => handleSort('shadow_multiplier')}>
                  Shadow ×{sortIcon('shadow_multiplier')}
                </th>
                <th>BBox (px)</th>
                <th>Geotag</th>
                <th onClick={() => handleSort('detected_at')}>
                  Time{sortIcon('detected_at')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(d => (
                <tr key={d.detection_id}>
                  <td><ClassBadge cls={d.class} /></td>
                  <td>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {d.detection_id}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: '0.75rem' }}>{d.source_image}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 120 }}>
                      <div className="confidence-bar-track" style={{ width: 50 }}>
                        <div className="confidence-bar-fill" style={{
                          width: `${d.confidence * 100}%`,
                          background: d.confidence >= 0.9 ? 'var(--bio-green)' : d.confidence >= 0.7 ? 'var(--sonar-cyan)' : 'var(--amber)',
                        }} />
                      </div>
                      <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {(d.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {d.raw_confidence !== null && d.raw_confidence !== undefined ? `${(d.raw_confidence * 100).toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td>
                    <span
                      className="mono"
                      style={{
                        fontSize: '0.8rem',
                        color: (d.shadow_multiplier ?? 1) >= 1 ? 'var(--bio-green)' : (d.shadow_multiplier ?? 1) < 0.7 ? 'var(--coral)' : 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      ×{d.shadow_multiplier?.toFixed(3) ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      [{d.bbox_px.join(',')}]
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {typeof d.geotag === 'object' ? `${d.geotag.lat.toFixed(4)}, ${d.geotag.lon.toFixed(4)}` : 'N/A'}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(d.detected_at).toLocaleTimeString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer note */}
        <div style={{
          padding: '1rem 1.25rem',
          background: 'hsla(38, 95%, 55%, 0.06)',
          border: '1px solid hsla(38, 95%, 55%, 0.2)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.82rem',
          color: 'var(--amber)',
          lineHeight: 1.6,
          marginBottom: '3rem',
        }}>
          ⚠️ <strong>Note:</strong> Without a nav track supplied on the Analyze page, the geotag field is
          <code style={{ background: 'rgba(0,0,0,0.2)', padding: '0.1rem 0.3rem', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>not_available_no_nav_metadata</code> because
          the sample PNG/JPG chips carry no navigation metadata. Enter a survey-line nav track (start/end lat-lon) to interpolate coordinates, or parse real XTF/JSF logs once <code style={{ background: 'rgba(0,0,0,0.2)', padding: '0.1rem 0.3rem', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>ingest.py</code> exists.
        </div>
      </div>
    </main>
  );
}
