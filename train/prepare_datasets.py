"""
prepare_datasets.py
Unifies the three labelled SSS sources already committed in the NotAISlop repo
into one tiled dataset of fixed-size patches, each tagged with a class:
    0 = background (clutter/seafloor, no object)
    1 = shipwreck   (AI4Shipwrecks, 261 labelled images)
    2 = pipe        (pipes/, 5 labelled images)
    3 = cylinder    (cylinders/samples, 3 labelled images, MILCO class)

ghost_nets is intentionally skipped: the repo's data/README.md confirms no
public SSS dump is copied there (Hugging Face gated), so there is nothing
labelled to pull for that class yet.

Output: data_prepared/tiles/<class_name>/*.png  (flat, ready for feature extraction)
        data_prepared/manifest.csv               (tile path, class, source image, bbox-in-tile or None)
"""
import os, glob, csv, random
import cv2
import numpy as np

random.seed(42)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
REPO = os.path.join(REPO_ROOT, "data")
OUT = os.path.join(REPO_ROOT, "data_prepared")
TILE = 256          # patch size fed to the classifier
CLASSES = ["background", "shipwreck", "pipe", "cylinder"]

for c in CLASSES:
    os.makedirs(os.path.join(OUT, "tiles", c), exist_ok=True)

manifest = []


def yolo_to_pixel_boxes(txt_path, img_w, img_h):
    boxes = []
    if not os.path.exists(txt_path) or os.path.getsize(txt_path) == 0:
        return boxes
    with open(txt_path) as f:
        for line in f:
            parts = line.split()
            if len(parts) != 5:
                continue
            _, cx, cy, w, h = parts
            cx, cy, w, h = float(cx) * img_w, float(cy) * img_h, float(w) * img_w, float(h) * img_h
            x1, y1, x2, y2 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
            boxes.append((x1, y1, x2, y2))
    return boxes


def tile_image(img_path, boxes, class_name, tile=TILE, stride=None, max_bg_per_image=3):
    """Slide a tile x tile window over the image. A tile is 'positive' if it
    covers most of a GT box; otherwise it's a background candidate."""
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return 0, 0
    h, w = img.shape
    stride = stride or tile
    pos_count = bg_count = 0
    stem = os.path.splitext(os.path.basename(img_path))[0]

    for y in range(0, max(1, h - tile + 1), stride):
        for x in range(0, max(1, w - tile + 1), stride):
            tx1, ty1, tx2, ty2 = x, y, x + tile, y + tile
            best_cov = 0.0
            tile_area = float(tile * tile)
            for (bx1, by1, bx2, by2) in boxes:
                ix1, iy1 = max(tx1, bx1), max(ty1, by1)
                ix2, iy2 = min(tx2, bx2), min(ty2, by2)
                iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
                inter = iw * ih
                box_area = max(1.0, (bx2 - bx1) * (by2 - by1))
                cov_of_box = inter / box_area   # how much of the GT object this tile captures
                cov_of_tile = inter / tile_area  # how much of this tile is object
                if cov_of_box > 0.6 or cov_of_tile > 0.4:
                    best_cov = max(best_cov, max(cov_of_box, cov_of_tile))

            patch = img[ty1:ty2, tx1:tx2]
            if patch.shape[0] != tile or patch.shape[1] != tile:
                patch = cv2.resize(patch, (tile, tile))

            if best_cov > 0.0:
                out_path = os.path.join(OUT, "tiles", class_name, f"{stem}_{x}_{y}.png")
                cv2.imwrite(out_path, patch)
                manifest.append([out_path, class_name, img_path])
                pos_count += 1
            elif best_cov == 0.0 and bg_count < max_bg_per_image:
                out_path = os.path.join(OUT, "tiles", "background", f"{stem}_bg_{x}_{y}.png")
                cv2.imwrite(out_path, patch)
                manifest.append([out_path, "background", img_path])
                bg_count += 1
    return pos_count, bg_count


def run():
    # ---- shipwrecks (AI4Shipwrecks train + test) ----
    total_pos = 0
    for split in ["train", "test"]:
        img_dir = os.path.join(REPO, "AI4Shipwrecks", split, "images")
        box_dir = os.path.join(REPO, "AI4Shipwrecks", split, "boxes")
        for img_path in sorted(glob.glob(os.path.join(img_dir, "*.png"))):
            stem = os.path.splitext(os.path.basename(img_path))[0]
            img_gray = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
            if img_gray is None:
                continue
            h, w = img_gray.shape
            boxes = yolo_to_pixel_boxes(os.path.join(box_dir, f"{stem}.txt"), w, h)
            if not boxes:
                continue  # skip pure-negative images here; negatives sampled below
            pos, bg = tile_image(img_path, boxes, "shipwreck", tile=TILE, stride=TILE // 2)
            total_pos += pos
    print(f"shipwreck positive tiles: {total_pos}")

    # extra background tiles from negative (no-wreck) AI4 images, capped
    neg_imgs = []
    for split in ["train", "test"]:
        img_dir = os.path.join(REPO, "AI4Shipwrecks", split, "images")
        box_dir = os.path.join(REPO, "AI4Shipwrecks", split, "boxes")
        for img_path in sorted(glob.glob(os.path.join(img_dir, "*.png"))):
            stem = os.path.splitext(os.path.basename(img_path))[0]
            box_file = os.path.join(box_dir, f"{stem}.txt")
            if not os.path.exists(box_file) or os.path.getsize(box_file) == 0:
                neg_imgs.append(img_path)
    random.shuffle(neg_imgs)
    for img_path in neg_imgs[:40]:
        tile_image(img_path, [], "background", tile=TILE, stride=TILE, max_bg_per_image=2)

    # ---- pipes ----
    total_pos = 0
    pipe_img_dir = os.path.join(REPO, "pipes", "images")
    pipe_lbl_dir = os.path.join(REPO, "pipes", "labels")
    for img_path in sorted(glob.glob(os.path.join(pipe_img_dir, "*.png"))):
        stem = os.path.splitext(os.path.basename(img_path))[0]
        img_gray = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        if img_gray is None:
            continue
        h, w = img_gray.shape
        boxes = yolo_to_pixel_boxes(os.path.join(pipe_lbl_dir, f"{stem}.txt"), w, h)
        pos, bg = tile_image(img_path, boxes, "pipe", tile=TILE, stride=64, max_bg_per_image=6)
        total_pos += pos
    print(f"pipe positive tiles: {total_pos}")

    # ---- cylinders ----
    total_pos = 0
    cyl_dir = os.path.join(REPO, "cylinders", "samples")
    for img_path in sorted(glob.glob(os.path.join(cyl_dir, "*.jpg"))):
        stem = os.path.splitext(os.path.basename(img_path))[0]
        img_gray = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        if img_gray is None:
            continue
        h, w = img_gray.shape
        boxes = yolo_to_pixel_boxes(os.path.join(cyl_dir, f"{stem}.txt"), w, h)
        pos, bg = tile_image(img_path, boxes, "cylinder", tile=TILE, stride=64, max_bg_per_image=6)
        total_pos += pos
    print(f"cylinder positive tiles: {total_pos}")

    manifest_path = os.path.join(OUT, "manifest.csv")
    with open(manifest_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["tile_path", "class", "source_image"])
        writer.writerows(manifest)

    print("\nTile counts per class:")
    for c in CLASSES:
        n = len(glob.glob(os.path.join(OUT, "tiles", c, "*.png")))
        print(f"  {c}: {n}")


if __name__ == "__main__":
    run()
