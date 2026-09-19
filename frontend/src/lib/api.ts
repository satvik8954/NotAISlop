/**
 * api.ts — client for the EchoTrace FastAPI backend.
 *
 * The backend serves the prototype detection pipeline (HOG+SVM sliding window,
 * shadow-consistency filter, geotagged report). Base URL comes from
 * NEXT_PUBLIC_API_URL (see .env.local); defaults to the standard local port.
 */
import type { Detection } from './types';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface ScanResult {
  imageName: string;
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  displayWidth: number;
  displayHeight: number;
  detections: Detection[];
  detectionCount: number;
  processedAt: string;
}

export interface AnalyzeParams {
  stride?: number;
  prob_thresh?: number;
  iou_thresh?: number;
  shadow_filter?: boolean;
  /** Optional nav track: "start_lat,start_lon,end_lat,end_lon" */
  nav_track?: string;
}

export interface AnalyzeResponse {
  mode: 'demo' | 'upload';
  scans: ScanResult[];
  errors?: { file: string; error: string }[];
  totalDetections: number;
  params: Record<string, unknown>;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_loading: boolean;
  model_load_seconds: number | null;
  error: string | null;
}

/** Backend detection class is one of the trained object classes (no background). */
export function normalizeDetections(scans: ScanResult[]): Detection[] {
  return scans.flatMap((s) =>
    s.detections.map((d) => ({ ...d, source_image: s.imageName }))
  );
}

async function handleFetch<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* keep HTTP status as the message */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  return handleFetch<HealthResponse>(res);
}

export async function fetchDemoImages(): Promise<{ images: { name: string; path: string }[] }> {
  const res = await fetch(`${API_BASE}/api/demo/images`);
  return handleFetch<{ images: { name: string; path: string }[] }>(res);
}

/** Run the pipeline over run_demo.py's four test images. */
export async function analyzeDemo(params: AnalyzeParams): Promise<AnalyzeResponse> {
  const form = new FormData();
  if (params.stride !== undefined) form.set('stride', String(params.stride));
  if (params.prob_thresh !== undefined) form.set('prob_thresh', String(params.prob_thresh));
  if (params.iou_thresh !== undefined) form.set('iou_thresh', String(params.iou_thresh));
  if (params.shadow_filter !== undefined) form.set('shadow_filter', String(params.shadow_filter));
  if (params.nav_track) form.set('nav_track', params.nav_track);

  const res = await fetch(`${API_BASE}/api/analyze/demo`, { method: 'POST', body: form });
  return handleFetch<AnalyzeResponse>(res);
}

/** Upload sonar images and run the pipeline over them. */
export async function analyzeUpload(
  files: File[],
  params: AnalyzeParams
): Promise<AnalyzeResponse> {
  const form = new FormData();
  for (const f of files) form.append('files', f, f.name);
  if (params.stride !== undefined) form.set('stride', String(params.stride));
  if (params.prob_thresh !== undefined) form.set('prob_thresh', String(params.prob_thresh));
  if (params.iou_thresh !== undefined) form.set('iou_thresh', String(params.iou_thresh));
  if (params.shadow_filter !== undefined) form.set('shadow_filter', String(params.shadow_filter));
  if (params.nav_track) form.set('nav_track', params.nav_track);

  const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: form });
  return handleFetch<AnalyzeResponse>(res);
}
