'use client';

import Link from 'next/link';

const pipelineSteps = [
  {
    id: 1,
    title: 'Sonar input',
    description: 'Ingest raw side-scan sonar logs (.xtf, .jsf) or high-res imagery from AUVs.',
    highlight: false,
  },
  {
    id: 2,
    title: 'Pre-processing',
    description: 'Speckle denoising, geometric correction, and tiling to 256×256 blocks.',
    highlight: false,
  },
  {
    id: 3,
    title: 'Detection inference',
    description: 'HOG+SVM or YOLOv8 sliding window scanning with non-maximum suppression.',
    highlight: false,
  },
  {
    id: 4,
    title: 'Shadow-consistency filter',
    description: 'Scores acoustic shadow geometry to separate real debris from natural seafloor clutter. Our core differentiator.',
    highlight: true,
  },
  {
    id: 5,
    title: 'Geotagging & reports',
    description: 'Interpolates ping navigation metadata to generate structured, geotagged CSV/JSON output.',
    highlight: false,
  }
];

export default function HomePage() {
  return (
    <main className="page">
      {/* ── Hero: The Echogram ── */}
      <section className="echo-hero">
        <div className="echogram"></div>
        <div className="scan-line"></div>
        
        {/* Decorative sonar annotations on the background */}
        <div className="sonar-annotation" data-label="shipwreck 98%" style={{ top: '25%', left: '15%', width: '120px', height: '140px', opacity: 0.8 }}></div>
        <div className="sonar-annotation" data-label="pipe 91%" style={{ top: '65%', right: '20%', width: '80px', height: '60px', opacity: 0.6 }}></div>
        <div className="sonar-annotation" data-label="clutter 40%" style={{ top: '40%', left: '60%', width: '150px', height: '90px', borderColor: 'var(--wake)' }}></div>

        <div className="container">
          <div className="echo-hero-content">
            <div className="echo-hero-label">EchoTrace #26</div>
            <h1 className="echo-hero-title">
              Detecting marine debris in side-scan sonar.
            </h1>
            <p className="echo-hero-desc">
              An AI-powered computer vision pipeline for oceanographers and conservationists. 
              We ingest raw sonar logs and automatically classify man-made debris, filtering out 
              false positives using acoustic shadow geometry.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
              <Link href="/analyze" className="btn btn-primary btn-lg">
                Run analysis
              </Link>
              <Link href="/results" className="btn btn-secondary btn-lg">
                View demo detections
              </Link>
            </div>

            <div className="hero-stats-row">
              <div className="hero-stat-cell">
                <span className="hero-stat-value">72%</span>
                <span className="hero-stat-label">Baseline accuracy</span>
              </div>
              <div className="hero-stat-cell">
                <span className="hero-stat-value">261</span>
                <span className="hero-stat-label">Training chips</span>
              </div>
              <div className="hero-stat-cell">
                <span className="hero-stat-value">4</span>
                <span className="hero-stat-label">Target classes</span>
              </div>
              <div className="hero-stat-cell">
                <span className="hero-stat-value">&lt;1s</span>
                <span className="hero-stat-label">Inference per scan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Architecture & Metrics ── */}
      <section style={{ padding: '5rem 0', background: 'var(--depth)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '4rem' }}>
            
            {/* Left: Pipeline flow */}
            <div>
              <h2 style={{ marginBottom: '2.5rem' }}>Pipeline architecture</h2>
              <div className="pipeline-flow">
                {pipelineSteps.map((step) => (
                  <div className="flow-step" key={step.id}>
                    <div className="flow-connector">
                      <div className={`flow-node ${step.highlight ? 'highlight' : ''}`}>
                        {step.id}
                      </div>
                      <div className="flow-line"></div>
                    </div>
                    <div className="flow-content">
                      <div className={`flow-title ${step.highlight ? 'highlight' : ''}`}>
                        {step.title}
                      </div>
                      <p className="flow-desc">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Technical Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="card">
                <h3 style={{ marginBottom: '1.25rem', color: 'var(--return)' }}>Why shadow consistency?</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--paper)', lineHeight: 1.7, marginBottom: '1rem' }}>
                  A real 3D object on the seafloor casts an acoustic shadow whose length relates directly to its height and the sonar's altitude and range. Natural clutter like sand ripples do not.
                </p>
                <div style={{
                  padding: '1rem',
                  background: 'var(--void)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--ping)',
                  border: '1px solid var(--wake)',
                }}>
                  object_height ≈ shadow_length × (alt / range)
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--paper)', lineHeight: 1.7, marginTop: '1rem' }}>
                  By extracting the shadow contrast and length directly behind a detected bounding box, our filter dramatically down-weights false positives from rocks and terrain.
                </p>
              </div>

              <div className="card">
                <h3 style={{ marginBottom: '1.25rem', color: 'var(--return)' }}>Prototype data sets</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { class: 'Shipwrecks', source: 'AI4Shipwrecks' },
                    { class: 'Pipelines', source: 'SubPipe Mini2' },
                    { class: 'Cylinders', source: 'Gavia AUV / MILCO' },
                    { class: 'Ghost nets', source: 'GhostVision (Pending)' },
                  ].map(d => (
                    <div key={d.class} style={{
                      display: 'flex', justifyContent: 'space-between',
                      paddingBottom: '0.75rem', borderBottom: '1px solid var(--wake)',
                      fontSize: '0.875rem',
                    }}>
                      <span style={{ fontWeight: 500 }}>{d.class}</span>
                      <span className="text-dim">{d.source}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </section>
    </main>
  );
}
