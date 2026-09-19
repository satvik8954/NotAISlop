"""
config.py
Paths, defaults and tunables for the EchoTrace API.

The detection pipeline itself (detect.py / shadow_filter.py / report.py) lives at
the repository root. This module puts that root on sys.path so the API can import
those modules unchanged -- the API is a thin serving layer over the prototype, not
a second copy of the model code.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

MODEL_PATH = REPO_ROOT / "models" / "tile_classifier.joblib"
VAL_REPORT_PATH = REPO_ROOT / "models" / "val_report.json"
RUNS_DIR = BACKEND_DIR / "runs"

# Defaults are run_demo.py's settings -- the exact parameters the committed
# outputs/detections.json was produced with, so a default run reproduces it.
DEFAULT_STRIDE = 96
DEFAULT_PROB_THRESH = 0.85
DEFAULT_IOU_THRESH = 0.2

# Long-side cap for the raster the browser canvas draws. Bounding boxes stay in
# original-image pixel space; DetectionCanvas scales using the image's own
# naturalWidth/naturalHeight, so serving a smaller raster never misaligns boxes.
MAX_DISPLAY_PX = 1400

MAX_UPLOAD_BYTES = 64 * 1024 * 1024
MAX_FILES_PER_JOB = 12
MAX_RETAINED_SCANS = 40

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}
# The upload widget accepts them, but there is no ingest.py in the repo yet, so
# binary sonar logs are rejected with an explicit message rather than silently
# handed to cv2.imread.
SONAR_LOG_SUFFIXES = {".xtf", ".jsf"}

# Demo images: genuinely unseen full images from the test split, same set as
# run_demo.py. Names are keys the client sends; paths never leave the server.
DEMO_IMAGES: dict[str, Path] = {
    "Corsair_01.png": REPO_ROOT / "data" / "AI4Shipwrecks" / "test" / "images" / "Corsair_01.png",
    "Monrovia_02.png": REPO_ROOT / "data" / "AI4Shipwrecks" / "test" / "images" / "Monrovia_02.png",
    "1693569523.810.png": REPO_ROOT / "data" / "pipes" / "images" / "1693569523.810.png",
    "0003_2021.jpg": REPO_ROOT / "data" / "cylinders" / "samples" / "0003_2021.jpg",
}


def cors_origins() -> list[str]:
    """Frontend origins allowed to call this API.

    Override with ECHOTRACE_CORS_ORIGINS="https://a.example,https://b.example".
    """
    raw = os.environ.get("ECHOTRACE_CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
