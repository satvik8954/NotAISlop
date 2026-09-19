/**
 * store.ts — session-level state for the latest analysis run.
 *
 * The three pages (analyze / results / report) are separate client-side
 * routes; this in-memory singleton lets analyze hand its result to the other
 * two without a server round-trip. It survives client-side navigation but not
 * a hard refresh — pages show an empty state pointing back to /analyze then.
 */
import type { AnalyzeResponse, ScanResult } from './api';
import type { Detection } from './types';

let current: AnalyzeResponse | null = null;
const listeners = new Set<() => void>();

export function setAnalysis(res: AnalyzeResponse): void {
  current = res;
  for (const fn of listeners) fn();
}

export function getAnalysis(): AnalyzeResponse | null {
  return current;
}

export function getScans(): ScanResult[] {
  return current?.scans ?? [];
}

export function getDetections(): Detection[] {
  return current ? current.scans.flatMap(s => s.detections) : [];
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
