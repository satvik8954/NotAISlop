"""
model_store.py
Loads the trained tile classifier once and shares it across requests.

joblib.load on the 36 MB SVM bundle takes ~7s, so it happens in a background
thread at startup: the server accepts connections immediately and /api/health
reports whether the model is warm yet. Anything that needs the model calls
get_model(), which blocks until the load finishes.
"""
from __future__ import annotations

import json
import threading
import time
from typing import Any

import config

_lock = threading.Lock()
_model: dict[str, Any] | None = None
_load_error: str | None = None
_load_seconds: float | None = None
_loaded = threading.Event()


def _load() -> None:
    global _model, _load_error, _load_seconds
    started = time.perf_counter()
    try:
        from detect import load_model  # repo-root pipeline module

        model = load_model(str(config.MODEL_PATH))
        with _lock:
            _model = model
            _load_seconds = time.perf_counter() - started
    except Exception as exc:  # surfaced through /api/health
        with _lock:
            _load_error = f"{type(exc).__name__}: {exc}"
            _load_seconds = time.perf_counter() - started
    finally:
        _loaded.set()


def start_warmup() -> None:
    """Kick off the model load without blocking server startup."""
    if _loaded.is_set():
        return
    with _lock:
        if not _loaded.is_set() and _load_error is None and _model is None:
            threading.Thread(target=_load, name="model-warmup", daemon=True).start()


def get_model() -> dict[str, Any]:
    """Return the loaded model bundle, waiting for the warm-up if needed."""
    start_warmup()
    _loaded.wait()
    with _lock:
        if _model is None:
            raise RuntimeError(_load_error or "model failed to load")
        return _model


def status() -> dict[str, Any]:
    with _lock:
        loaded = _model is not None
    return {
        "model_loaded": loaded,
        "model_loading": not _loaded.is_set(),
        "model_load_seconds": round(_load_seconds, 2) if _load_seconds else None,
        "model_path": str(config.MODEL_PATH),
        "model_present": config.MODEL_PATH.exists(),
        "error": _load_error,
    }


def describe() -> dict[str, Any]:
    """Model card: architecture, feature config and held-out validation scores."""
    model = get_model()
    clf = model["clf"]
    classes = [str(c) for c in model["label_encoder"].classes_]
    hog_params = dict(model["hog_params"])

    val_report = None
    if config.VAL_REPORT_PATH.exists():
        with open(config.VAL_REPORT_PATH) as f:
            val_report = json.load(f)

    n_support = getattr(clf, "n_support_", None)

    return {
        "architecture": "HOG + linear SVM tile classifier (sliding window)",
        "estimator": type(clf).__name__,
        "kernel": getattr(clf, "kernel", None),
        "classes": classes,
        "object_classes": [c for c in classes if c != "background"],
        "tile_size": int(model["tile_size"]),
        "hog_params": {
            "orientations": hog_params.get("orientations"),
            "pixels_per_cell": list(hog_params.get("pixels_per_cell", ())),
            "cells_per_block": list(hog_params.get("cells_per_block", ())),
        },
        "n_features": int(getattr(clf, "n_features_in_", 0)),
        "n_support_vectors": int(sum(n_support)) if n_support is not None else None,
        "nadir_guard_std": 8.0,
        "validation": val_report,
        "accuracy": (val_report or {}).get("accuracy"),
        "defaults": {
            "stride": config.DEFAULT_STRIDE,
            "prob_thresh": config.DEFAULT_PROB_THRESH,
            "iou_thresh": config.DEFAULT_IOU_THRESH,
        },
    }
