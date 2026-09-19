'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import type { Detection } from '@/lib/types';
import { CLASS_COLORS } from '@/lib/mockData';

interface DetectionCanvasProps {
  imageSrc: string | null;
  detections: Detection[];
  selectedId: string | null;
  onSelectDetection: (id: string) => void;
  minConfidence: number;
  activeClasses: Set<string>;
}

export default function DetectionCanvas({
  imageSrc,
  detections,
  selectedId,
  onSelectDetection,
  minConfidence,
  activeClasses,
}: DetectionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  // Canvas-to-image scale lives in a ref: it's needed at click time only and
  // putting it in state would re-render (and thus redraw) on every draw.
  const scaleRef = useRef({ x: 1, y: 1 });

  // Memoized so drawCanvas keeps a stable identity across renders.
  const filtered = useMemo(
    () => detections.filter(
      d => d.confidence >= minConfidence && (activeClasses.size === 0 || activeClasses.has(d.class))
    ),
    [detections, minConfidence, activeClasses]
  );

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale to fit within 800x600 display area
    const maxW = 800, maxH = 580;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    const displayW = img.naturalWidth * ratio;
    const displayH = img.naturalHeight * ratio;

    canvas.width = displayW;
    canvas.height = displayH;
    scaleRef.current = { x: ratio, y: ratio };

    // Draw image
    ctx.drawImage(img, 0, 0, displayW, displayH);

    // Overlay: dark mask on non-selected
    if (selectedId) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, displayW, displayH);
    }

    // Draw bboxes
    for (const d of filtered) {
      const [x1, y1, x2, y2] = d.bbox_px;
      const sx1 = x1 * ratio, sy1 = y1 * ratio;
      const sw = (x2 - x1) * ratio, sh = (y2 - y1) * ratio;

      const color = CLASS_COLORS[d.class] ?? '#fff';
      const isSelected = d.detection_id === selectedId;

      if (isSelected) {
        // Re-draw area under selected box
        ctx.drawImage(img, x1, y1, x2 - x1, y2 - y1, sx1, sy1, sw, sh);
      }

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = isSelected ? 20 : 8;

      // Box
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeRect(sx1 + 1, sy1 + 1, sw - 2, sh - 2);
      ctx.shadowBlur = 0;

      // Semi-transparent fill
      ctx.fillStyle = color + (isSelected ? '20' : '0a');
      ctx.fillRect(sx1 + 1, sy1 + 1, sw - 2, sh - 2);

      // Label background
      const label = `${d.class} ${(d.confidence * 100).toFixed(0)}%`;
      ctx.font = `bold ${isSelected ? 13 : 11}px "Space Mono", monospace`;
      const textW = ctx.measureText(label).width;
      const labelH = isSelected ? 20 : 17;
      const lx = sx1, ly = sy1 - labelH;

      ctx.fillStyle = color;
      ctx.fillRect(lx, Math.max(0, ly), textW + 10, labelH);
      ctx.fillStyle = '#000';
      ctx.fillText(label, lx + 5, Math.max(labelH - 4, sy1 - 4));
    }
  }, [filtered, selectedId, imageSrc]);

  // Load image when src changes
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageSrc;
  }, [imageSrc, drawCanvas]);

  // Redraw when selection changes
  useEffect(() => {
    if (imageRef.current?.complete) drawCanvas();
  }, [drawCanvas]);

  // Click handler: find which bbox was clicked
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

    for (const d of [...filtered].reverse()) {
      const [x1, y1, x2, y2] = d.bbox_px;
      const sx1 = x1 * scaleRef.current.x, sy1 = y1 * scaleRef.current.y;
      const sx2 = x2 * scaleRef.current.x, sy2 = y2 * scaleRef.current.y;
      if (mx >= sx1 && mx <= sx2 && my >= sy1 && my <= sy2) {
        onSelectDetection(d.detection_id);
        return;
      }
    }
    onSelectDetection('');
  };

  if (!imageSrc) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🖼️</div>
        <div className="empty-title">No image selected</div>
        <div className="empty-sub">Select a scan result from the list to view detections</div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ cursor: 'crosshair', maxWidth: '100%', display: 'block' }}
    />
  );
}
