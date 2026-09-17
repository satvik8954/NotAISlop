import os
import glob
import shutil
import random
import json
from pathlib import Path
from collections import defaultdict
from PIL import Image

# Paths
ROOT = Path("c:/Users/madhu/Downloads/sih/notaislop/data")
OUT_DIR = Path("c:/Users/madhu/Downloads/sih/notaislop/unified_dataset_balanced")

CLASS_MAP = {
    "shipwreck": 0,
    "pipe": 1,
    "cylinder": 2,
    "ghost_gear": 3,
    "clutter": 4
}

def setup_dirs():
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    for split in ["train", "val", "test"]:
        (OUT_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (OUT_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

def get_yolo_labels(label_path, class_mapping):
    labels = []
    if label_path.exists():
        with open(label_path, "r") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 5:
                    try:
                        orig_cls = int(float(parts[0]))
                        if orig_cls in class_mapping:
                            new_cls = class_mapping[orig_cls]
                            labels.append(f"{new_cls} {' '.join(parts[1:5])}")
                    except ValueError:
                        pass
    return labels

def extract_ghost_nets():
    # Read the JSONL and convert to YOLO
    gn_root = ROOT / "ghost_nets" / "hf" / "sss-crab-pot-detection-ds"
    records = []

    for split in ["train", "valid", "test"]:
        jsonl_path = gn_root / split / "metadata.jsonl"
        if not jsonl_path.exists(): continue

        with open(jsonl_path, "r") as f:
            for line in f:
                if not line.strip(): continue
                data = json.loads(line.strip())
                img_name = data["file_name"]
                img_path = gn_root / split / img_name

                if not img_path.exists(): continue

                bboxes = data.get("objects", {}).get("bbox", [])

                yolo_labels = []
                if bboxes:
                    with Image.open(img_path) as im:
                        img_w, img_h = im.size

                    for bbox in bboxes:
                        x, y, w, h = bbox
                        x_center = x + w / 2.0
                        y_center = y + h / 2.0

                        norm_x = x_center / img_w
                        norm_y = y_center / img_h
                        norm_w = w / img_w
                        norm_h = h / img_h

                        # Class 3 for ghost_gear
                        yolo_labels.append(f"{CLASS_MAP['ghost_gear']} {norm_x:.6f} {norm_y:.6f} {norm_w:.6f} {norm_h:.6f}")

                if yolo_labels:
                    records.append((img_path, yolo_labels, CLASS_MAP['ghost_gear']))

    return records

def collect_all_data():
    dataset_records = defaultdict(list)

    # 1. AI4Shipwrecks
    print("Collecting Shipwrecks...")
    for split_dir in ["train", "test"]:
        img_dir = ROOT / "AI4Shipwrecks" / split_dir / "images"
        box_dir = ROOT / "AI4Shipwrecks" / split_dir / "boxes"
        if not img_dir.exists(): continue
        for img_path in img_dir.glob("*.png"):
            label_path = box_dir / f"{img_path.stem}.txt"
            labels = get_yolo_labels(label_path, {0: CLASS_MAP["shipwreck"]})
            if labels:
                dataset_records[CLASS_MAP["shipwreck"]].append((img_path, labels))

    # 2. SubPipeMini2
    print("Collecting Pipes...")
    pipe_root = ROOT / "SubPipeMini2" / "SubPipeMiniSSS" / "DATA"
    for freq in ["SSS_HF_images", "SSS_LF_images"]:
        img_dir = pipe_root / freq / "Image"
        ann_dir = pipe_root / freq / "YOLO_Annotation"
        if not img_dir.exists(): continue
        # SubPipeMini images are .pbm
        for img_path in img_dir.glob("*.pbm"):
            label_path = ann_dir / f"{img_path.stem}.txt"
            labels = get_yolo_labels(label_path, {0: CLASS_MAP["pipe"], 1: CLASS_MAP["pipe"]})
            if labels:
                dataset_records[CLASS_MAP["pipe"]].append((img_path, labels))

    # 3. Cylinders (MILCO) & Clutter (NOMBO)
    print("Collecting Cylinders & Clutter...")
    cyl_root = ROOT / "cylinders" / "cylider2.v6i.yolov8"
    for split_dir in ["train", "valid", "test"]:
        img_dir = cyl_root / split_dir / "images"
        lbl_dir = cyl_root / split_dir / "labels"
        if not img_dir.exists(): continue
        for img_path in img_dir.glob("*.jpg"):
            label_path = lbl_dir / f"{img_path.stem}.txt"
            labels = get_yolo_labels(label_path, {0: CLASS_MAP["cylinder"], 1: CLASS_MAP["clutter"]})
            if labels:
                # Assign image to the dominant class present
                first_class = int(labels[0].split()[0])
                dataset_records[first_class].append((img_path, labels))

    # 4. Ghost Nets
    print("Collecting Ghost Nets...")
    gn_records = extract_ghost_nets()
    for img_path, labels, cls in gn_records:
        dataset_records[cls].append((img_path, labels))

    return dataset_records

def process_datasets():
    setup_dirs()
    random.seed(42)

    dataset_records = collect_all_data()

    # Determine the balancing target (e.g., matching the smallest class or setting a fixed cap)
    # Let's cap around 200 per class to balance
    TARGET_PER_CLASS = 200

    balanced_records = []

    for cls, records in dataset_records.items():
        random.shuffle(records)
        sampled = records[:TARGET_PER_CLASS]
        balanced_records.extend(sampled)
        print(f"Class {cls}: Total available = {len(records)}, Sampled = {len(sampled)}")

    # Shuffle the final balanced dataset before splitting
    random.shuffle(balanced_records)

    total_images = 0
    total_labels = 0

    for idx, (img_path, labels) in enumerate(balanced_records):
        rand_val = random.random()
        if rand_val < 0.8: split = "train"
        elif rand_val < 0.9: split = "val"
        else: split = "test"

        # Save PNG to avoid format issues (especially for PBM)
        new_stem = f"{img_path.parent.parent.name}_{img_path.stem}"
        dest_img = OUT_DIR / split / "images" / (new_stem + ".png")
        dest_label = OUT_DIR / split / "labels" / (new_stem + ".txt")

        # Convert and save image
        with Image.open(img_path) as im:
            # SubPipe .pbm is sometimes grayscale/binary, converting to RGB or L is safe
            im.convert("RGB").save(dest_img)

        with open(dest_label, "w") as f:
            f.write("\n".join(labels) + "\n")

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

    print(f"Done! Created BALANCED dataset with {total_images} images and {total_labels} labeled instances.")

if __name__ == "__main__":
    process_datasets()
