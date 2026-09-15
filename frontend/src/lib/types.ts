export interface Detection {
  detection_id: string;
  source_image: string;
  class: 'shipwreck' | 'pipe' | 'cylinder' | 'ghost_net';
  confidence: number;
  raw_confidence: number;
  shadow_multiplier: number;
  bbox_px: [number, number, number, number]; // [x1, y1, x2, y2]
  geotag: string | { lat: number; lon: number };
  detected_at: string;
}

export interface PipelineStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'error';
  duration?: number;
}

export interface ScanResult {
  imageName: string;
  imagePath: string;
  detections: Detection[];
  processedAt: string;
}

export type DetectionClass = 'shipwreck' | 'pipe' | 'cylinder' | 'ghost_net' | 'all';

export interface DetectionStats {
  total: number;
  byClass: Record<string, number>;
  avgConfidence: number;
  avgShadowMultiplier: number;
  highConfidence: number; // > 0.9
  mediumConfidence: number; // 0.7-0.9
  lowConfidence: number; // < 0.7
}
