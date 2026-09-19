/**
 * mockData.ts — shared display helpers for detection data.
 *
 * The mock arrays used during UI prototyping are gone: detection data now
 * comes live from the FastAPI backend (see api.ts / store.ts). What remains
 * are the pure helpers every page uses: class colours/labels and stat
 * aggregation over whatever Detection[] the API returned.
 */
import type { Detection, DetectionStats, ScanResult } from './types';

export function computeStats(detections: Detection[]): DetectionStats {
  const byClass: Record<string, number> = {};
  let totalConf = 0;
  let totalShadow = 0;
  let high = 0, medium = 0, low = 0;

  for (const d of detections) {
    byClass[d.class] = (byClass[d.class] || 0) + 1;
    totalConf += d.confidence;
    totalShadow += d.shadow_multiplier ?? 0;
    if (d.confidence >= 0.9) high++;
    else if (d.confidence >= 0.7) medium++;
    else low++;
  }

  return {
    total: detections.length,
    byClass,
    avgConfidence: detections.length ? totalConf / detections.length : 0,
    avgShadowMultiplier: detections.length ? totalShadow / detections.length : 0,
    highConfidence: high,
    mediumConfidence: medium,
    lowConfidence: low,
  };
}

export const CLASS_COLORS: Record<string, string> = {
  shipwreck: '#00d4ff',
  pipe: '#39ff8f',
  cylinder: '#ffb800',
  ghost_net: '#ff6b9d',
};

export const CLASS_LABELS: Record<string, string> = {
  shipwreck: 'Shipwreck',
  pipe: 'Pipeline',
  cylinder: 'Cylinder',
  ghost_net: 'Ghost Net',
};

/** Re-export so existing imports keep working. */
export type { ScanResult };
