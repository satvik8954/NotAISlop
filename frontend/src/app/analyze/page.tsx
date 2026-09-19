'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { PipelineStep } from '@/lib/types';
import { analyzeDemo, analyzeUpload, API_BASE, type AnalyzeResponse } from '@/lib/api';
import { setAnalysis } from '@/lib/store';

const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'ingest', label: 'Ingest', description: 'Read sonar imagery, extract nav metadata', status: 'pending' },
  { id: 'preprocess', label: 'Preprocess', description: 'Histogram equalisation, nadir guard (std < 8), 256×256 tiles', status: 'pending' },
  { id: 'detect', label: 'Detect', description: 'HOG+SVM sliding window + NMS', status: 'pending' },
  { id: 'shadow', label: 'Shadow Filter', description: 'Acoustic shadow consistency scoring', status: 'pending' },
  { id: 'report', label: 'Report', description: 'Generate geotagged JSON/CSV', status: 'pending' },
];

type RunStatus = 'idle' | 'running' | 'done' | 'error';

const NAV_PLACEHOLDER = '11.7401, 92.6586, 11.7455, 92.6612';

export default function AnalyzePage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [demoMode, setDemoMode] = useState(true);
  const [probThresh, setProbThresh] = useState(0.85);
  const [iouThresh, setIouThresh] = useState(0.2);
  const [stride, setStride] = useState(96);
  const [shadowEnabled, setShadowEnabled] = useState(true);
  const [navTrack, setNavTrack] = useState('');
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE_STEPS);
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backend health check — banner if the FastAPI server isn't running
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(r => r.ok ? setApiUp(true) : setApiUp(false))
      .catch(() => setApiUp(false));
  }, []);

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

  // Animate steps as the request progresses. Detection dominates runtime,
  // so it gets the widest progress band; the bar completes when the response lands.
  const runPipeline = async () => {
    setRunStatus('running');
    setError(null);
    setProgress(0);
    setSteps(PIPELINE_STEPS.map(s => ({ ...s, status: 'pending' })));

    const setStep = (idx: number, status: PipelineStep['status']) =>
      setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status } : s));

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // quick visual pass over ingest/preprocess while the request is in flight
      setStep(0, 'running');
      setProgress(10);
      timer = setTimeout(() => { setStep(0, 'done'); setStep(1, 'running'); setProgress(30); }, 400);
      timer = setTimeout(() => { setStep(1, 'done'); setStep(2, 'running'); setProgress(50); }, 900);

      const nav = navTrack.trim() ? navTrack.trim() : undefined;
      const params = {
        stride,
        prob_thresh: probThresh,
        iou_thresh: iouThresh,
        shadow_filter: shadowEnabled,
        nav_track: nav,
      };
      const res = demoMode
        ? await analyzeDemo(params)
        : await analyzeUpload(uploadedFiles, params);

      clearTimeout(timer);
      setSteps(prev => prev.map(s => ({ ...s, status: 'done' })));
      setProgress(100);
      setResult(res);
      setAnalysis(res);
      setRunStatus('done');
    } catch (err) {
      clearTimeout(timer);
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'error' } : s));
      setError(err instanceof Error ? err.message : 'Pipeline failed');
      setRunStatus('error');
    }
  };

  const reset = () => {
    setSteps(PIPELINE_STEPS);
    setRunStatus('idle');
    setResult(null);
    setError(null);
    setProgress(0);
    if (!demoMode) setUploadedFiles([]);
  };

  const canRun = (demoMode || uploadedFiles.length > 0) && runStatus !== 'running';

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

        {apiUp === false && (
          <div style={{
            padding: '0.875rem 1rem', marginBottom: '1.25rem',
            background: 'hsla(38, 95%, 55%, 0.08)', border: '1px solid hsla(38, 95%, 55%, 0.3)',
            borderRadius: 'var(--radius-md)', color: 'var(--amber)', fontSize: '0.85rem',
          }}>
            ⚠️ <strong>Backend offline.</strong> Start it with{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>cd backend && uvicorn main:app --port 8000</code>
          </div>
        )}

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
                      Runs the real detection pipeline on 4 held-out test sonar images (AI4Shipwrecks, SubPipe, NOMBO).
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {['Corsair_01.png — shipwreck test image', 'Monrovia_02.png — shipwreck test image', '1693569523.810.png — pipe image', '0003_2021.jpg — cylinder chip'].map(name => (
                    <div key={name} style={{
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
                          {name}
                        </span>
                      </div>
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
                      {step.status === 'done' ? '✓' : step.status === 'running' ? '⟳' : step.status === 'error' ? '!' : i + 1}
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

              {runStatus === 'error' && error && (
                <div style={{
                  padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
                  background: 'hsla(0, 85%, 55%, 0.08)', border: '1px solid hsla(0, 85%, 55%, 0.3)',
                  color: 'var(--coral)', fontSize: '0.85rem',
                }}>
                  ❌ {error}
                </div>
              )}

              {runStatus === 'done' && result && (
                <div style={{
                  padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)',
                  background: 'hsla(155, 85%, 45%, 0.08)', border: '1px solid hsla(155, 85%, 45%, 0.3)',
                  color: 'var(--bio-green)', fontSize: '0.875rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  ✅ Pipeline complete — {result.totalDetections} detections across {result.scans.length} image{result.scans.length !== 1 ? 's' : ''}
                </div>
              )}

              {runStatus === 'done' && result?.errors && result.errors.length > 0 && (
                <div style={{
                  marginTop: '0.5rem', padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-md)',
                  background: 'hsla(38, 95%, 55%, 0.06)', border: '1px solid hsla(38, 95%, 55%, 0.25)',
                  color: 'var(--amber)', fontSize: '0.8rem',
                }}>
                  {result.errors.map(e => (
                    <div key={e.file}>⚠️ {e.file}: {e.error}</div>
                  ))}
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

            <div className="slider-wrap">
              <div className="slider-header">
                <label className="slider-label">Window Stride (px)</label>
                <span className="slider-val">{stride}</span>
              </div>
              <input
                type="range"
                min={32}
                max={192}
                step={32}
                value={stride}
                onChange={e => setStride(Number(e.target.value))}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Sliding-window step (64 = dense/slow, 96 = demo default, 192 = fast)
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3>Options</h3>
              <label
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  padding: '0.875rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  cursor: 'pointer', transition: 'border-color var(--transition-fast)',
                }}
              >
                <input
                  type="checkbox"
                  checked={shadowEnabled}
                  onChange={e => setShadowEnabled(e.target.checked)}
                  style={{ marginTop: '3px', accentColor: 'var(--sonar-cyan)', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Shadow-Consistency Filter</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                    Re-weight confidence by acoustic shadow geometry
                  </div>
                </div>
              </label>

              {/* Optional nav track for geotagging */}
              <div
                style={{
                  padding: '0.875rem', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                  Nav Track <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  start_lat, start_lon, end_lat, end_lon — interpolates geotags along the survey line
                </div>
                <input
                  type="text"
                  value={navTrack}
                  onChange={e => setNavTrack(e.target.value)}
                  placeholder={NAV_PLACEHOLDER}
                  style={{
                    width: '100%', padding: '0.5rem 0.625rem',
                    fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
                    background: 'var(--bg-deep, #0a121c)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 6px)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div className="divider" style={{ margin: '0' }} />

            {/* Quick info */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.375rem' }}>
                About the model
              </strong>
              HOG + LinearSVM tile classifier, 71.6% held-out accuracy over
              4 classes. Tile 256×256, stride 96px demo default, nadir guard std &lt; 8.0.
              Runs live via FastAPI at <code style={{ fontFamily: 'var(--font-mono)' }}>localhost:8000</code>.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
