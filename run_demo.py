import cv2
import glob
import os
from detect import detect
from shadow_filter import apply_shadow_filter
from report import build_report, write_json, write_csv

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(REPO_ROOT, "outputs")
os.makedirs(OUT_DIR, exist_ok=True)

COLORS = {"shipwreck": (0, 0, 255), "pipe": (0, 200, 255), "cylinder": (0, 255, 0)}

# pick a few test images the classifier never trained on the *exact* crops of
# (train/val split was tile-level, so use genuinely unseen full images from test/)
TEST_IMAGES = [
    os.path.join(REPO_ROOT, "data", "AI4Shipwrecks", "test", "images", "Corsair_01.png"),
    os.path.join(REPO_ROOT, "data", "AI4Shipwrecks", "test", "images", "Monrovia_02.png"),
    os.path.join(REPO_ROOT, "data", "pipes", "images", "1693569523.810.png"),
    os.path.join(REPO_ROOT, "data", "cylinders", "samples", "0003_2021.jpg"),
]

all_records = []
for img_path in TEST_IMAGES:
    if not os.path.exists(img_path):
        print("missing:", img_path)
        continue
    dets, shape = detect(img_path, stride=96, prob_thresh=0.85, iou_thresh=0.2)
    dets = apply_shadow_filter(img_path, dets)
    records = build_report(img_path, dets, shape, nav_track=None)
    all_records += records

    img = cv2.imread(img_path)
    if img is None:
        continue
    for d in dets:
        x1, y1, x2, y2 = d["bbox"]
        color = COLORS.get(d["class"], (255, 255, 255))
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 3)
        label = f"{d['class']} {d['confidence']:.2f}"
        cv2.putText(img, label, (x1, max(15, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    stem = os.path.splitext(os.path.basename(img_path))[0]
    out_path = os.path.join(OUT_DIR, f"annotated_{stem}.png")
    cv2.imwrite(out_path, img)
    print(f"{img_path}: {len(dets)} detections -> {out_path}")

write_json(all_records, os.path.join(OUT_DIR, "detections.json"))
write_csv(all_records, os.path.join(OUT_DIR, "detections.csv"))
print(f"\nTotal detections across demo images: {len(all_records)}")
print(f"Report written to {os.path.join(OUT_DIR, 'detections.json')} and .csv")
