"""
shadow_filter.py
Implements the "shadow-consistency filter" from the EchoTrace architecture.

A real 3D object on the seafloor casts an acoustic shadow: a dark region
immediately beyond it in the across-track (row) direction. Natural clutter
(sand ripples, noise speckle) usually does not cast a consistent elongated
dark region. Without per-image altitude/range metadata (not present in the
sample data pulled from the repo) we can't compute true object height, but
we can still score *shadow consistency* -- how much darker and how uniform
the region right past the detection is versus the ambient seafloor -- and
use it to re-weight the classifier's confidence, exactly as the
architecture doc specifies conceptually.
"""
import cv2
import numpy as np


def shadow_consistency_score(img_gray, bbox, shadow_band_frac=0.6):
    """Returns a multiplier in [0.4, 1.15] applied to the raw classifier
    confidence: boosts detections with a plausible shadow, downweights ones
    without (likely clutter)."""
    x1, y1, x2, y2 = bbox
    h, w = img_gray.shape
    box_h = y2 - y1
    band = max(4, int(box_h * shadow_band_frac))

    # region just "below" the detection in image (across-track) direction
    sy1, sy2 = y2, min(h, y2 + band)
    if sy2 <= sy1:
        return 0.8  # detection touches image edge, can't verify -> mild penalty

    obj_patch = img_gray[y1:y2, x1:x2]
    shadow_patch = img_gray[sy1:sy2, x1:x2]
    # local seafloor reference: a same-size patch further out, past the shadow zone
    ry1, ry2 = sy2, min(h, sy2 + band)
    ref_patch = img_gray[ry1:ry2, x1:x2] if ry2 > ry1 else obj_patch

    if obj_patch.size == 0 or shadow_patch.size == 0:
        return 0.8

    obj_mean = float(np.mean(obj_patch))
    shadow_mean = float(np.mean(shadow_patch))
    ref_mean = float(np.mean(ref_patch)) if ref_patch.size else obj_mean

    # a real shadow is darker than both the object echo and the surrounding seafloor
    contrast = (ref_mean - shadow_mean) / (ref_mean + 1e-6)
    contrast = max(-1.0, min(1.0, contrast))

    if contrast > 0.15:
        return 1.0 + min(0.15, contrast * 0.3)     # consistent shadow -> boost
    elif contrast > 0.0:
        return 1.0                                  # weak/ambiguous -> unchanged
    else:
        return max(0.4, 1.0 + contrast)             # no shadow -> penalize toward 0.4


def apply_shadow_filter(img_path, detections):
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return detections
    out = []
    for d in detections:
        mult = shadow_consistency_score(img, d["bbox"])
        adj_conf = min(0.99, d["confidence"] * mult)
        out.append({**d, "raw_confidence": d["confidence"], "shadow_multiplier": round(mult, 3),
                    "confidence": round(adj_conf, 3)})
    return out
