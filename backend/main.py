"""
main.py
EchoTrace FastAPI backend.

Serves the prototype detection pipeline (detect.py / shadow_filter.py /
report.py at the repo root) to the Next.js frontend:

  GET  /api/health          -- server + model warm-up status
  GET  /api/model           -- model card (architecture, HOG params, val scores)
  GET  /api/demo/images     -- the run_demo.py image set for demo mode
  POST /api/analyze/demo    -- run the pipeline over the demo set
  POST /api/analyze         -- upload files and run the pipeline on them

Run:  uvicorn main:app --port 8000  (from the backend/ directory)
"""
from __future__ import annotations

import threading
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
import model_store
import pipeline_service

app = FastAPI(
    title="EchoTrace API",
    description="Underwater marine debris & anomaly detection on side-scan sonar imagery",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _warmup() -> None:
    model_store.start_warmup()


class NavTrack(BaseModel):
    start_lat: float = Field(ge=-90, le=90)
    start_lon: float = Field(ge=-180, le=180)
    end_lat: float = Field(ge=-90, le=90)
    end_lon: float = Field(ge=-180, le=180)


def _nav_track_from_form(nav: str | None) -> dict[str, float] | None:
    """Parse the nav-track form field ("lat,lon,lat,lon") into report.py's dict."""
    if not nav or not nav.strip():
        return None
    parts = [p.strip() for p in nav.split(",")]
    if len(parts) != 4:
        raise HTTPException(400, "nav_track must be 'start_lat,start_lon,end_lat,end_lon'")
    try:
        vals = [float(p) for p in parts]
    except ValueError:
        raise HTTPException(400, "nav_track values must be numbers")
    return NavTrack(
        start_lat=vals[0], start_lon=vals[1], end_lat=vals[2], end_lon=vals[3]
    ).model_dump()


def _bounds_from_form(
    stride: str | None, prob: str | None, iou: str | None, shadow: str | None
) -> dict[str, Any]:
    """Parse and range-check the detection-parameter form fields."""
    try:
        stride_val = int(stride) if stride else config.DEFAULT_STRIDE
        prob_val = float(prob) if prob else config.DEFAULT_PROB_THRESH
        iou_val = float(iou) if iou else config.DEFAULT_IOU_THRESH
    except ValueError:
        raise HTTPException(400, "stride must be an integer; prob/iou must be numbers")

    stride_val = max(16, min(256, stride_val))
    prob_val = max(0.05, min(0.99, prob_val))
    iou_val = max(0.05, min(0.9, iou_val))
    shadow_val = (shadow or "true").lower() not in {"false", "0", "no", "off"}
    return {"stride": stride_val, "prob_thresh": prob_val, "iou_thresh": iou_val, "shadow_filter_enabled": shadow_val}


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", **model_store.status()}


@app.get("/api/model")
def model_info() -> dict[str, Any]:
    try:
        return model_store.describe()
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))


@app.get("/api/demo/images")
def demo_images() -> dict[str, Any]:
    """The demo-mode image list: same set run_demo.py processes."""
    images = [
        {"name": name, "path": str(path)}
        for name, path in config.DEMO_IMAGES.items()
        if path.exists()
    ]
    return {"images": images}


@app.post("/api/analyze/demo")
def analyze_demo(
    stride: str | None = Form(None),
    prob_thresh: str | None = Form(None),
    iou_thresh: str | None = Form(None),
    shadow_filter: str | None = Form(None),
    nav_track: str | None = Form(None),
) -> dict[str, Any]:
    params = _bounds_from_form(stride, prob_thresh, iou_thresh, shadow_filter)
    nav = _nav_track_from_form(nav_track)
    results = pipeline_service.run_demo_batch(**params, nav_track=nav)
    return {
        "mode": "demo",
        "scans": results,
        "totalDetections": sum(r["detectionCount"] for r in results),
        "params": params,
    }


@app.post("/api/analyze")
async def analyze(
    files: list[UploadFile] = File(...),
    stride: str | None = Form(None),
    prob_thresh: str | None = Form(None),
    iou_thresh: str | None = Form(None),
    shadow_filter: str | None = Form(None),
    nav_track: str | None = Form(None),
) -> dict[str, Any]:
    if not files:
        raise HTTPException(400, "no files uploaded")
    if len(files) > config.MAX_FILES_PER_JOB:
        raise HTTPException(400, f"too many files (max {config.MAX_FILES_PER_JOB})")

    params = _bounds_from_form(stride, prob_thresh, iou_thresh, shadow_filter)
    nav = _nav_track_from_form(nav_track)

    results = []
    errors = []
    for f in files:
        data = await f.read()
        if len(data) > config.MAX_UPLOAD_BYTES:
            errors.append({"file": f.filename, "error": "file too large"})
            continue
        suffix = ("." + f.filename.rsplit(".", 1)[-1].lower()) if "." in f.filename else ""
        if suffix in config.SONAR_LOG_SUFFIXES:
            errors.append({
                "file": f.filename,
                "error": "XTF/JSF sonar logs are not yet supported (no ingest.py in this prototype); upload an exported PNG/JPG image",
            })
            continue
        if suffix not in config.IMAGE_SUFFIXES:
            errors.append({"file": f.filename, "error": f"unsupported file type '{suffix or '(none)'}'"})
            continue
        try:
            img = pipeline_service._decode_upload(data, f.filename)
            results.append(
                pipeline_service.process_image(img, f.filename, **params, nav_track=nav)
            )
        except ValueError as exc:
            errors.append({"file": f.filename, "error": str(exc)})

    return {
        "mode": "upload",
        "scans": results,
        "errors": errors,
        "totalDetections": sum(r["detectionCount"] for r in results),
        "params": params,
    }
