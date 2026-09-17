import os
import glob
import shutil
import random
import json
from pathlib import Path
from collections import defaultdict
from PIL import Image
import concurrent.futures

# Paths are relative to this script so the pipeline works from any checkout.
PROJECT_ROOT = Path(__file__).resolve().parent
ROOT = PROJECT_ROOT / "data"
FINAL_OUT = PROJECT_ROOT / "dataset_final"

# Old directories to delete
OLD_DIRS = [
    PROJECT_ROOT / "unified_dataset",
    PROJECT_ROOT / "unified_dataset_balanced",
    PROJECT_ROOT / "unified_dataset_optimal"
]

CLASS_MAP = {
    "shipwreck": 0,
    "pipe": 1,
    "cylinder": 2,
    "ghost_gear": 3,
    "clutter": 4
}

def cleanup_old_datasets():
    for d in OLD_DIRS:
        if d.exists():
            print(f"Removing old dataset: {d.name}")
            shutil.rmtree(d, ignore_errors=True)

def setup_dirs():
    if FINAL_OUT.exists():
        shutil.rmtree(FINAL_OUT)
    for split in ["train", "val", "test"]:
        (FINAL_OUT / split / "images").mkdir(parents=True, exist_ok=True)
        (FINAL_OUT / split / "labels").mkdir(parents=True, exist_ok=True)

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
    gn_root = ROOT / "ghost_nets" / "hf" / "sss-crab-pot-detection-ds"
    records = []

    for split in ["train", "valid", "test"]:
        jsonl_path = gn_root / split / "metadata.jsonl"
        if not jsonl_path.exists(): continue

        all_imgs = set(gn_root.glob(f"{split}/*.jpg"))
        labeled_imgs = set()

        with open(jsonl_path, "r") as f:
            for line in f:
                if not line.strip(): continue
                data = json.loads(line.strip())
                img_name = data["file_name"]
                img_path = gn_root / split / img_name

                if not img_path.exists(): continue
                labeled_imgs.add(img_path)

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
                        yolo_labels.append(f"{CLASS_MAP['ghost_gear']} {norm_x:.6f} {norm_y:.6f} {norm_w:.6f} {norm_h:.6f}")

                records.append((img_path, yolo_labels, CLASS_MAP['ghost_gear'] if yolo_labels else "background"))

        unlabeled = all_imgs - labeled_imgs
        for img_path in unlabeled:
            records.append((img_path, [], "background"))

    return records

def collect_all_data():
    dataset_records = defaultdict(list)

    # AI4Shipwrecks
    for split_dir in ["train", "test"]:
        img_dir = ROOT / "AI4Shipwrecks" / split_dir / "images"
        box_dir = ROOT / "AI4Shipwrecks" / split_dir / "boxes"
        if not img_dir.exists(): continue
        for img_path in img_dir.glob("*.png"):
            label_path = box_dir / f"{img_path.stem}.txt"
            labels = get_yolo_labels(label_path, {0: CLASS_MAP["shipwreck"]})
            cls_key = CLASS_MAP["shipwreck"] if labels else "background"
            dataset_records[cls_key].append((img_path, labels))

    # SubPipeMini2
    pipe_root = ROOT / "SubPipeMini2" / "SubPipeMiniSSS" / "DATA"
    for freq in ["SSS_HF_images", "SSS_LF_images"]:
        img_dir = pipe_root / freq / "Image"
        ann_dir = pipe_root / freq / "YOLO_Annotation"
        if not img_dir.exists(): continue
        for img_path in img_dir.glob("*.pbm"):
            label_path = ann_dir / f"{img_path.stem}.txt"
            labels = get_yolo_labels(label_path, {0: CLASS_MAP["pipe"], 1: CLASS_MAP["pipe"]})
            cls_key = CLASS_MAP["pipe"] if labels else "background"
            dataset_records[cls_key].append((img_path, labels))

    # Cylinders & Clutter
    cyl_root = ROOT / "cylinders" / "cylider2.v6i.yolov8"
    for split_dir in ["train", "valid", "test"]:
        img_dir = cyl_root / split_dir / "images"
        lbl_dir = cyl_root / split_dir / "labels"
        if not img_dir.exists(): continue
        for img_path in img_dir.glob("*.jpg"):
            label_path = lbl_dir / f"{img_path.stem}.txt"
            labels = get_yolo_labels(label_path, {0: CLASS_MAP["cylinder"], 1: CLASS_MAP["clutter"]})
            if labels:
                first_class = int(labels[0].split()[0])
                dataset_records[first_class].append((img_path, labels))
            else:
                dataset_records["background"].append((img_path, []))

    # Ghost Nets
    gn_records = extract_ghost_nets()
    for img_path, labels, cls in gn_records:
        dataset_records[cls].append((img_path, labels))

    return dataset_records

def process_single_image(args):
    img_path, labels, split = args
    new_stem = f"{img_path.parent.parent.name}_{img_path.stem}"
    dest_label = FINAL_OUT / split / "labels" / (new_stem + ".txt")

    with open(dest_label, "w") as f:
        if labels:
            f.write("\n".join(labels) + "\n")

    if img_path.suffix.lower() == ".pbm":
        dest_img = FINAL_OUT / split / "images" / (new_stem + ".jpg")
        with Image.open(img_path) as im:
            im.convert("RGB").save(dest_img, "JPEG", quality=90)
    else:
        dest_img = FINAL_OUT / split / "images" / (new_stem + img_path.suffix)
        shutil.copy2(img_path, dest_img)

    return bool(labels)

def process_datasets():
    cleanup_old_datasets()
    setup_dirs()
    random.seed(42)

    dataset_records = collect_all_data()

    # We want a FINAL BALANCED OPTIMAL dataset.
    # Cap positives at 200, cap background hard negatives at 200.
    TARGET_PER_CLASS = 200

    balanced_records = []

    for cls, records in dataset_records.items():
        random.shuffle(records)
        sampled = records[:TARGET_PER_CLASS]
        balanced_records.extend(sampled)
        print(f"Class '{cls}': Total available = {len(records)}, Sampled = {len(sampled)}")

    random.shuffle(balanced_records)

    tasks = []
    for img_path, labels in balanced_records:
        rand_val = random.random()
        if rand_val < 0.8: split = "train"
        elif rand_val < 0.9: split = "val"
        else: split = "test"
        tasks.append((img_path, labels, split))

    print(f"Starting parallel processing for {len(tasks)} balanced images...")

    total_images = len(tasks)
    total_positives = 0
    total_backgrounds = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        results = list(executor.map(process_single_image, tasks))

    for has_labels in results:
        if has_labels: total_positives += 1
        else: total_backgrounds += 1

    yaml_content = f"""path: {FINAL_OUT.resolve().as_posix()}
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
    with open(FINAL_OUT / "data.yaml", "w") as f:
        f.write(yaml_content)

    print(f"\\nSUCCESS! One single final dataset built at {FINAL_OUT}")

if __name__ == "__main__":
    process_datasets()
