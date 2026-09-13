"""
detect.py
Runs the trained tile classifier over a full side-scan sonar image as a
sliding window, producing bounding-box detections for shipwreck/pipe/cylinder.
This is the 'Detection / segmentation' stage of the EchoTrace architecture.
"""
import os
import cv2
import numpy as np
import joblib
from skimage.feature import hog

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(REPO_ROOT, "models", "tile_classifier.joblib")


def load_model(model_path=None):
    path = model_path or MODEL_PATH
    return joblib.load(path)


def sliding_window_detect(img_path, model, stride=64, prob_thresh=0.55):
    bundle = model
    clf, le, hog_params, tile = (
        bundle["clf"], bundle["label_encoder"], bundle["hog_params"], bundle["tile_size"],
    )
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return [], (0, 0)
    h, w = img.shape
    detections = []

    bg_index = list(le.classes_).index("background")

    for y in range(0, max(1, h - tile + 1), stride):
        for x in range(0, max(1, w - tile + 1), stride):
            patch = img[y:y + tile, x:x + tile]
            if patch.shape[0] != tile or patch.shape[1] != tile:
                patch = cv2.resize(patch, (tile, tile))

            # nadir / no-return guard: the water-column gap directly under
            # the towfish is near-uniform (very low std) and isn't seafloor
            # at all -- standard SSS preprocessing masks it out before
            # detection so a classifier never gets the chance to mistake a
            # featureless dark strip for an object. Skip it here.
            if float(patch.std()) < 8.0:
                continue

            patch = cv2.equalizeHist(patch)
            feat = hog(patch, **hog_params).reshape(1, -1)
            probs = clf.predict_proba(feat)[0]
            best_idx = int(np.argmax(probs))
            if best_idx == bg_index:
                continue
            if probs[best_idx] < prob_thresh:
                continue
            detections.append({
                "class": le.classes_[best_idx],
                "confidence": float(probs[best_idx]),
                "bbox": [x, y, x + tile, y + tile],
            })
    return detections, (h, w)


def nms(detections, iou_thresh=0.3):
    if not detections:
        return []
    boxes = np.array([d["bbox"] for d in detections], dtype=float)
    scores = np.array([d["confidence"] for d in detections])
    order = scores.argsort()[::-1]
    keep = []
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)

    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w_ = np.maximum(0, xx2 - xx1)
        h_ = np.maximum(0, yy2 - yy1)
        inter = w_ * h_
        iou = inter / (areas[i] + areas[order[1:]] - inter)
        order = order[1:][iou < iou_thresh]

    return [detections[i] for i in keep]


def detect(img_path, stride=64, prob_thresh=0.55, iou_thresh=0.3, model_path=None):
    model = load_model(model_path)
    dets, shape = sliding_window_detect(img_path, model, stride=stride, prob_thresh=prob_thresh)
    dets = nms(dets, iou_thresh=iou_thresh)
    return dets, shape
