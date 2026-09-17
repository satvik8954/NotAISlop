import os
import shutil
import glob
from pathlib import Path
import cv2
import albumentations as A
import numpy as np

# Define unified class mapping
CLASS_MAP = {
    "shipwreck": 0,
    "pipe": 1,
    "cylinder": 2, # MILCO
    "ghost_gear": 3,
    "clutter": 4 # NOMBO
}

def setup_directories(base_dir="unified_dataset"):
    """Create train/val structure for YOLO"""
    for split in ["train", "val"]:
        for img_type in ["images", "labels"]:
            os.makedirs(os.path.join(base_dir, split, img_type), exist_ok=True)
    return base_dir

def get_augmentation_pipeline():
    """
    Define safe augmentations for Side-Scan Sonar.
    Avoid arbitrary rotations or vertical flips to maintain shadow geometry.
    """
    return A.Compose([
        # Simulate acoustic speckle noise
        A.GaussNoise(var_limit=(10.0, 50.0), p=0.3),
        A.MultiplicativeNoise(multiplier=(0.9, 1.1), p=0.3),
        # Adjust contrast and brightness (simulate different sonar gains)
        A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.5),
        # Horizontal flip is often okay if the nadir isn't part of the feature
        A.HorizontalFlip(p=0.5),
    ], bbox_params=A.BboxParams(format='yolo', label_fields=['class_labels']))

def process_and_augment_image(img_path, label_path, out_img_path, out_label_path, augment=False):
    """Read image and label, optionally augment, and save."""
    # Read image
    img = cv2.imread(str(img_path))
    if img is None:
        return

    # Read YOLO labels
    bboxes = []
    class_labels = []
    if os.path.exists(label_path):
        with open(label_path, 'r') as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) == 5:
                    class_labels.append(int(parts[0]))
                    bboxes.append([float(x) for x in parts[1:]])

    # Augment
    if augment and len(bboxes) > 0:
        transform = get_augmentation_pipeline()
        try:
            transformed = transform(image=img, bboxes=bboxes, class_labels=class_labels)
            img = transformed['image']
            bboxes = transformed['bboxes']
            class_labels = transformed['class_labels']
        except Exception as e:
            print(f"Augmentation failed for {img_path}: {e}")
            pass # fallback to original

    # Save output image
    cv2.imwrite(str(out_img_path), img)

    # Save output labels (or empty file for implicit negatives)
    with open(out_label_path, 'w') as f:
        for bbox, cls_id in zip(bboxes, class_labels):
            f.write(f"{cls_id} {' '.join([f'{x:.6f}' for x in bbox])}\n")

def curate_datasets():
    base_out = setup_directories("c:/Users/madhu/Downloads/sih/notaislop/unified_dataset")
    print(f"Initialized output directory at {base_out}")

    # ---------------------------------------------------------
    # Example snippet for processing one of the datasets (Gavia)
    # The same logic applies to others once annotations are standardized
    # ---------------------------------------------------------

    gavia_dir = "c:/Users/madhu/Downloads/sih/notaislop/data/cylinders/samples"

    # Find all images
    img_files = glob.glob(f"{gavia_dir}/*.jpg")

    for i, img_path in enumerate(img_files):
        img_name = os.path.basename(img_path)
        base_name = os.path.splitext(img_name)[0]
        label_path = os.path.join(gavia_dir, f"{base_name}.txt")

        # Decide split (naive 80/20)
        split = "train" if i % 5 != 0 else "val"

        # We need to remap classes: Gavia has 0=MILCO, 1=NOMBO
        # Target: MILCO(cylinder)=2, NOMBO(clutter)=4

        temp_label_path = label_path + ".tmp"
        if os.path.exists(label_path):
            with open(label_path, 'r') as src, open(temp_label_path, 'w') as dst:
                for line in src:
                    parts = line.strip().split()
                    if not parts: continue
                    old_cls = int(parts[0])
                    new_cls = CLASS_MAP["cylinder"] if old_cls == 0 else CLASS_MAP["clutter"]
                    dst.write(f"{new_cls} {' '.join(parts[1:])}\n")
        else:
            # Create empty for negative sample
            open(temp_label_path, 'w').close()

        out_img = os.path.join(base_out, split, "images", f"gavia_{img_name}")
        out_lbl = os.path.join(base_out, split, "labels", f"gavia_{base_name}.txt")

        # Apply augmentation only to training data
        do_augment = (split == "train")

        process_and_augment_image(img_path, temp_label_path, out_img, out_lbl, augment=do_augment)

        if os.path.exists(temp_label_path):
            os.remove(temp_label_path)

    print("Dataset curation pipeline generated. Review the Python script for adapting to all datasets.")

if __name__ == "__main__":
    curate_datasets()
