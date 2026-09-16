"""
pipeline_service.py
Runs the prototype detection pipeline over one image and returns the scan
result the frontend renders: detections (post shadow filter), image
dimensions, and a display raster.

Uses the repo-root modules verbatim -- detect.py's sliding-window + NMS,
shadow_filter.py's consistency re-weighting, report.py's record building
(including pixel_to_latlon when a nav track is supplied). The only new
behaviour is the display raster: large SSS images are downsampled along the
long side before JPEG-encoding so the browser doesn't fetch 6 MB PNGs.
Bounding boxes remain in original-image pixel space; DetectionCanvas scales
them via the image's natural dimensions, so overlays stay aligned.
"""
from __future__ import annotations

import base64
import datetime
import os
import tempfile
from typing import Any

import cv2
import numpy as np

import config
import model_store


def _decode_upload(data: bytes, filename: str) -> np.ndarray:
    """Decode an uploaded image from file bytes (path-safe on Windows)."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError(f"could not decode image: {filename}")
    return img


def _to_display_jpeg(img: np.ndarray, max_px: int = config.MAX_DISPLAY_PX) -> tuple[tuple[int, int], bytes]:
    """Return ((display_w, display_h), jpeg_bytes) for the browser raster."""
    h, w = img.shape[:2]
    scale = min(1.0, max_px / max(h, w))
    if scale < 1.0:
        disp = cv2.resize(img, (max(1, int(w * scale)), max(1, int(h * scale))))
    else:
        disp = img
    ok, buf = cv2.imencode(".jpg", disp, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise RuntimeError("failed to encode display raster")
    return (disp.shape[1], disp.shape[0]), buf.tobytes()


def process_image(
    image: np.ndarray,
    source_name: str,
    *,
    stride: int = config.DEFAULT_STRIDE,
    prob_thresh: float = config.DEFAULT_PROB_THRESH,
    iou_thresh: float = config.DEFAULT_IOU_THRESH,
    shadow_filter_enabled: bool = True,
    nav_track: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Full pipeline over one grayscale image. Returns the API scan object."""
    from detect import sliding_window_detect, nms
    from shadow_filter import apply_shadow_filter
    from report import build_report

    # The prototype stages read from a path, so materialise the in-memory
    # image once and run every stage against the same temp file.
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.close()
    try:
        cv2.imwrite(tmp.name, image)

        # 1. detection: sliding window + NMS (shared model, no reload per call)
        model = model_store.get_model()
        raw_dets, _shape = sliding_window_detect(tmp.name, model, stride=stride, prob_thresh=prob_thresh)
        dets = nms(raw_dets, iou_thresh=iou_thresh)

        # 2. shadow-consistency filter (toggleable, on by default)
        if shadow_filter_enabled:
            dets = apply_shadow_filter(tmp.name, dets)

        # 3. report records (detection_id, geotag via nav_track, timestamps)
        h, w = image.shape[:2]
        records = build_report(source_name, dets, (h, w), nav_track=nav_track)
    finally:
        os.unlink(tmp.name)

    detections = [
        {
            "detection_id": r["detection_id"],
            "source_image": source_name,
            "class": r["class"],
            "confidence": r["confidence"],
            "raw_confidence": r.get("raw_confidence"),
            "shadow_multiplier": r.get("shadow_multiplier"),
            "bbox_px": r["bbox_px"],
            "geotag": r["geotag"],
            "detected_at": r["detected_at"],
        }
        for r in records
    ]

    # 4. display raster for the browser canvas
    (disp_w, disp_h), jpeg_bytes = _to_display_jpeg(image)

    return {
        "imageName": source_name,
        "imageDataUrl": "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode(),
        "imageWidth": w,
        "imageHeight": h,
        "displayWidth": disp_w,
        "displayHeight": disp_h,
        "detections": detections,
        "detectionCount": len(detections),
        "processedAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def run_demo_batch(
    *,
    stride: int = config.DEFAULT_STRIDE,
    prob_thresh: float = config.DEFAULT_PROB_THRESH,
    iou_thresh: float = config.DEFAULT_IOU_THRESH,
    shadow_filter_enabled: bool = True,
    nav_track: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    """Run the pipeline over the fixed demo set (run_demo.py's four images)."""
    results = []
    for name, path in config.DEMO_IMAGES.items():
        if not path.exists():
            continue
        img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
        results.append(
            process_image(
                img, name, stride=stride, prob_thresh=prob_thresh,
                iou_thresh=iou_thresh, shadow_filter_enabled=shadow_filter_enabled,
                nav_track=nav_track,
            )
        )
    return results
