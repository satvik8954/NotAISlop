import os
import glob
import shutil
import random
import json
from pathlib import Path

# Paths are relative to this script so the pipeline works from any checkout.
PROJECT_ROOT = Path(__file__).resolve().parent
ROOT = PROJECT_ROOT / "data"
OUT_DIR = PROJECT_ROOT / "unified_dataset"

def setup_dirs():
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    for split in ["train", "val", "test"]:
        (OUT_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (OUT_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

def parse_yolo_label(label_path, class_map):
    labels = []
    if label_path.exists():
        with open(label_path, "r") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 5:
                    try:
                        # Use float() then int() to handle "0.0" if present
                        orig_cls = int(float(parts[0]))
                        if orig_cls in class_map:
                            new_cls = class_map[orig_cls]
                            labels.append(f"{new_cls} {' '.join(parts[1:5])}")
                    except ValueError:
                        continue
    return labels

def process_datasets():
    setup_dirs()
    random.seed(42)

    total_images = 0
    total_labels = 0

    # 1. AI4Shipwrecks (Shipwrecks)
    # Masks to boxes must have been run. Class 0 -> 0 (shipwreck)
    print("Processing AI4Shipwrecks...")
    for split_dir in ["train", "test"]:
        img_dir = ROOT / "AI4Shipwrecks" / split_dir / "images"
        box_dir = ROOT / "AI4Shipwrecks" / split_dir / "boxes"
        if not img_dir.exists(): continue
        for img_path in img_dir.glob("*.png"):
            label_path = box_dir / f"{img_path.stem}.txt"
            labels = parse_yolo_label(label_path, {0: 0})
            save_pair("shipwrecks", img_path, labels)
            total_images += 1
            total_labels += len(labels)

    # 2. SubPipeMini2 (Pipes)
    # YOLO_Annotation mapping. Class 0/1 -> 1 (pipe)
    print("Processing SubPipeMini2...")
    pipe_root = ROOT / "SubPipeMini2" / "SubPipeMiniSSS" / "DATA"
    for freq in ["SSS_HF_images", "SSS_LF_images"]:
        img_dir = pipe_root / freq / "Image"
        ann_dir = pipe_root / freq / "YOLO_Annotation"
        if not img_dir.exists(): continue
        for img_path in img_dir.glob("*.jpg"):
            label_path = ann_dir / f"{img_path.stem}.txt"
            labels = parse_yolo_label(label_path, {0: 1, 1: 1})
            save_pair("pipes", img_path, labels)
            total_images += 1
            total_labels += len(labels)

    # 3. Cylinders (Gavia MILCO/NOMBO)
    # Class 0 -> 2 (cylinder), Class 1 -> 4 (clutter)
    print("Processing Cylinders...")
    cyl_root = ROOT / "cylinders" / "cylider2.v6i.yolov8"
    for split_dir in ["train", "valid", "test"]:
        img_dir = cyl_root / split_dir / "images"
        lbl_dir = cyl_root / split_dir / "labels"
        if not img_dir.exists(): continue
        for img_path in img_dir.glob("*.jpg"):
            label_path = lbl_dir / f"{img_path.stem}.txt"
            # Explicitly map the NOMBO class (1) to our clutter class (4)
            labels = parse_yolo_label(label_path, {0: 2, 1: 4})
            save_pair("cylinders", img_path, labels)
            total_images += 1
            total_labels += len(labels)

    # 4. Ghost Nets (GhostVision Crab Pots)
    # Provided in HuggingFace format. Some might have YOLO .txt, but usually it's JSONL or COCO.
    # We will check if .txt exists. If not, this is why they were missed!
    print("Processing Ghost Nets...")
    gn_root = ROOT / "ghost_nets" / "hf" / "sss-crab-pot-detection-ds"
    for split_dir in ["train", "valid", "test"]:
        split_path = gn_root / split_dir
        if not split_path.exists(): continue
        # Note: If Ghost Nets uses _annotations.coco.json, we'd need a COCO parser here.
        # For now, we look for .txt. If none exist, we know this dataset is contributing 0 labels.
        for img_path in split_path.glob("*.jpg"):
            label_path = split_path / f"{img_path.stem}.txt"
            labels = parse_yolo_label(label_path, {0: 3})
            save_pair("ghost_nets", img_path, labels)
            total_images += 1
            total_labels += len(labels)

    # Generate data.yaml
    yaml_content = f"""path: {OUT_DIR.resolve().as_posix()}
train: train/images
val: val/images
test: test/images

names:
  0: shipwreck
  1: pipe
  2: cylinder
  3: ghost_gear
  4: clutter
"""
    with open(OUT_DIR / "data.yaml", "w") as f:
        f.write(yaml_content)

    print(f"Done! Created dataset with {total_images} images and {total_labels} labeled instances.")

def save_pair(prefix, img_path, labels):
    rand_val = random.random()
    if rand_val < 0.8: split = "train"
    elif rand_val < 0.9: split = "val"
    else: split = "test"

    new_stem = f"{prefix}_{img_path.stem}"
    dest_img = OUT_DIR / split / "images" / (new_stem + img_path.suffix)
    dest_label = OUT_DIR / split / "labels" / (new_stem + ".txt")

    shutil.copy2(img_path, dest_img)
    if labels:
        with open(dest_label, "w") as f:
            f.write("\n".join(labels) + "\n")
    else:
        open(dest_label, "w").close()

if __name__ == "__main__":
    process_datasets()
