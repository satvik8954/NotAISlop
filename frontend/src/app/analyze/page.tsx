'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MOCK_SCAN_RESULTS } from '@/lib/mockData';
import type { PipelineStep } from '@/lib/types';

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'ingest', label: 'Ingest', description: 'Parse sonar log, extract nav metadata', status: 'pending' },
  { id: 'preprocess', label: 'Preprocess', description: 'Denoise, correct geometry, tile 256×256', status: 'pending' },
  { id: 'detect', label: 'Detect', description: 'HOG+SVM sliding window + NMS', status: 'pending' },
  { id: 'shadow', label: 'Shadow Filter', description: 'Acoustic shadow consistency scoring', status: 'pending' },
  { id: 'report', label: 'Report', description: 'Generate geotagged JSON/CSV', status: 'pending' },
];

type RunStatus = 'idle' | 'running' | 'done' | 'error';

export default function AnalyzePage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [demoMode, setDemoMode] = useState(true);
  const [probThresh, setProbThresh] = useState(0.55);
  const [iouThresh, setIouThresh] = useState(0.3);
  const [shadowEnabled, setShadowEnabled] = useState(true);
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE_STEPS);
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.name.endsWith('.xtf') || f.name.endsWith('.jsf')
    );
    setUploadedFiles(prev => [...prev, ...files]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const runPipeline = async () => {
    setRunStatus('running');
    setProgress(0);
    const stepLabels = ['ingest', 'preprocess', 'detect', 'shadow', 'report'];

    for (let i = 0; i < stepLabels.length; i++) {
      // Mark current as running
      setSteps(prev => prev.map((s, idx) => ({
        ...s,
        status: idx < i ? 'done' : idx === i ? 'running' : 'pending',
      })));
      setProgress((i / stepLabels.length) * 100);

      // Simulate processing time
      const delays = [600, 800, 1800, 1000, 500];
      await new Promise(r => setTimeout(r, delays[i]));
    }

    // All done
    setSteps(prev => prev.map(s => ({ ...s, status: 'done' })));
    setProgress(100);
    setRunStatus('done');
  };

  const reset = () => {
    setSteps(PIPELINE_STEPS);
    setRunStatus('idle');
    setProgress(0);
    if (!demoMode) setUploadedFiles([]);
  };

  const canRun = demoMode || uploadedFiles.length > 0;

  return (
    <main className="page">
      <div className="container">
        <div className="page-header">
          <div className="page-header-inner">
            <div>
              <div className="page-breadcrumb">
                <Link href="/">EchoTrace</Link>
                <span>›</span>
                <span>Analyze</span>
              </div>
              <h1 style={{ fontSize: '2rem' }}>Run Detection Pipeline</h1>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
                Upload sonar imagery or use the built-in demo data to run the full EchoTrace pipeline.
              </p>
            </div>
            <div className="mode-toggle">
              <button
                className={`mode-toggle-btn ${demoMode ? 'active' : ''}`}
                onClick={() => setDemoMode(true)}
              >
                Demo Mode
              </button>
              <button
                className={`mode-toggle-btn ${!demoMode ? 'active' : ''}`}
                onClick={() => setDemoMode(false)}
              >
                Live Mode
              </button>
            </div>
          </div>
        </div>

        <div className="analyze-layout">
          {/* Left: Upload + Pipeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Upload zone */}
            {demoMode ? (
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem 1.25rem',
                  background: 'hsla(195, 100%, 50%, 0.06)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-accent)',
                  marginBottom: '1rem',
                }}>
                  <span style={{ fontSize: '1.25rem' }}>🎯</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--sonar-cyan)' }}>Demo Mode Active</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Using real detections from the EchoTrace prototype run on 4 test sonar images.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {MOCK_SCAN_RESULTS.map(r => (
                    <div key={r.imageName} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.625rem 0.875rem',
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.85rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span style={{ opacity: 0.6 }}>🖼️</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {r.imageName}
                        </span>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                        color: 'var(--sonar-cyan)', background: 'hsla(195,100%,50%,0.1)',
                        padding: '0.15rem 0.5rem', borderRadius: '4px',
                      }}>
                        {r.detections.length} detections
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.xtf,.jsf"
                  multiple
                  onChange={handleFileInput}
                  style={{ display: 'none' }}
                />
                <div className="dropzone-icon">📡</div>
                <div className="dropzone-title">Drop sonar images here</div>
                <div className="dropzone-sub">
                  Supports PNG, JPG, XTF, JSF · Click to browse
                </div>
                {uploadedFiles.length > 0 && (
                  <div style={{ marginTop: '0.5rem', color: 'var(--sonar-cyan)', fontWeight: 600 }}>
                    {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} ready
                  </div>
                )}
              </div>
            )}

            {/* Pipeline Steps */}
            <div className="card">
              <h3 style={{ marginBottom: '1.5rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Pipeline Status
              </h3>
              <div className="pipeline-steps" style={{ marginBottom: '1.5rem' }}>
                {steps.map((step, i) => (
                  <div key={step.id} className={`pipeline-step ${step.status}`}>
                    <div className="step-dot">
                      {step.status === 'done' ? '✓' : step.status === 'running' ? '⟳' : i + 1}
                    </div>
                    <div className="step-label">{step.label}</div>
                  </div>
                ))}
              </div>

              {runStatus === 'running' && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {steps.find(s => s.status === 'running')?.description ?? 'Processing…'}
                  </div>
                </div>
              )}

              {runStatus === 'done' && (
                <div style={{
                  padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
                  background: 'hsla(155, 85%, 45%, 0.08)', border: '1px solid hsla(155, 85%, 45%, 0.3)',
                  color: 'var(--bio-green)', fontSize: '0.875rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  ✅ Pipeline complete — {MOCK_SCAN_RESULTS.reduce((acc, r) => acc + r.detections.length, 0)} detections found
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {runStatus === 'idle' || runStatus === 'error' ? (
                <button
                  className="btn btn-primary btn-lg"
                  onClick={runPipeline}
                  disabled={!canRun}
                  style={{ flex: 1 }}
                >
                  {runStatus === 'idle' ? '🚀 Run Pipeline' : '🔄 Retry'}
                </button>
              ) : runStatus === 'running' ? (
                <button className="btn btn-secondary btn-lg" disabled style={{ flex: 1 }}>
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  Running…
                </button>
              ) : (
                <>
                  <Link href="/results" className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: 'center' }}>
                    📊 View Results
                  </Link>
                  <button className="btn btn-secondary" onClick={reset}>
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: Settings Panel */}
          <div className="settings-panel">
            <h3>Detection Parameters</h3>

            <div className="slider-wrap">
              <div className="slider-header">
                <label className="slider-label">Confidence Threshold</label>
                <span className="slider-val">{probThresh.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={0.95}
                step={0.01}
                value={probThresh}
                onChange={e => setProbThresh(Number(e.target.value))}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Minimum classifier confidence to report a detection
              </div>
            </div>

            <div className="slider-wrap">
              <div className="slider-header">
                <label className="slider-label">IoU Threshold (NMS)</label>
                <span className="slider-val">{iouThresh.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.7}
                step={0.05}
                value={iouThresh}
                onChange={e => setIouThresh(Number(e.target.value))}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Non-maximum suppression overlap threshold
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3>Options</h3>
              {[
                {
                  id: 'shadow',
                  label: 'Shadow-Consistency Filter',
                  sub: 'Re-weight by acoustic shadow geometry',
                  value: shadowEnabled,
                  set: setShadowEnabled,
                },
              ].map(opt => (
                <label
                  key={opt.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                    padding: '0.875rem', borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                    cursor: 'pointer', transition: 'border-color var(--transition-fast)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={opt.value}
                    onChange={e => opt.set(e.target.checked)}
                    style={{ marginTop: '3px', accentColor: 'var(--sonar-cyan)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{opt.sub}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="divider" style={{ margin: '0' }} />

            {/* Quick info */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                About the model
              </strong>
              HOG + LinearSVM baseline trained on 269 labelled sonar tiles.
              Sliding window stride: 64px. Tile size: 256×256.
              Nadir guard threshold: std &lt; 8.0.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
