# EchoTrace SSS Data Preparation Pipeline

## 1. Overview
This pipeline outlines the process of unifying four distinct Side-Scan Sonar (SSS) datasets into a single, training-ready YOLO format dataset for the EchoTrace marine debris detection model.

## 2. Available Datasets & Context
The project aims to detect man-made debris (shipwrecks, pipes, cylinders, ghost gear) and filter out natural clutter using acoustic shadow consistency.

### Datasets Included:
1. **AI4Shipwrecks (Shipwrecks):** 
   - 286 images, 161 with wrecks (125 implicit negative backgrounds). 
   - Labels: Pixel masks (need conversion to YOLO boxes). 
   - Source: EdgeTech 2205.
2. **SubPipe Mini2 (Pipes):** 
   - 10,030 images, 6,335 boxes. 
   - Labels: YOLO/COCO. 
   - Note: Exclude camera data; only use SSS subset.
3. **Gavia MILCO / NOMBO (Cylinders & Negatives):** 
   - 1,170 images. 
   - Labels: YOLO (Class 0 = MILCO/Cylinder, Class 1 = NOMBO/Clutter). 
   - Source: Gavia AUV.
4. **GhostVision (Ghost Nets / Crab Pots):** 
   - 6,674 images. 
   - Labels: JSONL (needs conversion). 
   - Source: Humminbird SSS.

### Excluded / Avoided Data:
- **SeabedObjects-KLSG:** This dataset only provides image-level classification (chips) without bounding boxes or masks. Therefore, **it cannot be used for object detection training.**
- **Marine PULSE:** Similar to KLSG, lacks bounding boxes.
- **FLS/Camera/RGB Data:** Irrelevant to the SSS objective.

## 3. Metadata & Scale Inconsistencies
Side-scan sonar images heavily depend on the sonar's altitude, range, and frequency.
*   **Scale Variance:** A shipwreck can span 50 meters, a pipe can cross the entire swath, while a cylinder or crab pot is usually 1-2 meters.
*   **Physical Properties:** The `README` states `object_height ≈ shadow_length × (altitude / range)`. Combining these datasets means mixing different altitudes and ranges. 
*   **Resolution:** Images from Gavia AUV and EdgeTech 2205 will have different spatial resolutions (meters/pixel).
*   **Consistency Strategy:** When combining, we must **never alter the aspect ratio** drastically. Resizing must use padding (letterboxing). Augmentations that break shadow geometry (like arbitrary rotations) must be restricted.

## 4. Handling Negative Labels
Negative samples are crucial to reduce false positives from natural acoustic clutter (rocks, sand ripples).
*   **Explicit Negatives (NOMBO):** The Gavia dataset provides explicit bounding boxes for NOMBOs (Non-Mine-Like Bottom Objects). These can be used as a "clutter" class or background.
*   **Implicit Negatives:** AI4Shipwrecks has 125 images with no wrecks. We include these in YOLO format simply by providing an image with an empty `.txt` annotation file.

## 5. Unified YOLO Class Mapping
To combine the datasets, we remap all classes into a single unified schema:
*   `0`: shipwreck
*   `1`: pipe
*   `2`: cylinder (from MILCO)
*   `3`: ghost_gear (from crab pots)
*   `4`: clutter (from NOMBO)

## 6. Augmentation Strategy
Given the physics of side-scan sonar, augmentations must be acoustically plausible:
*   **Allowed:** Horizontal flips (only if the nadir line location doesn't break model assumptions, otherwise restricted), Contrast adjustment, Gaussian Noise, Speckle Noise, brightness variations.
*   **Avoid:** 90-degree or arbitrary rotations (this breaks the directional nature of shadows relative to the sonar ping), Vertical flips (can flip the shadow to the wrong side of the highlight depending on where nadir is).

## 7. Pipeline Steps
1. **Extraction & Mask Conversion:** Unzip archives. Convert AI4Shipwrecks masks to bounding boxes (using `masks_to_boxes.py`).
2. **Standardization:** Convert GhostVision JSONL and SubPipe COCO annotations to YOLO format.
3. **Class Remapping:** Rewrite all `.txt` files to use the unified class mapping.
4. **Train/Val/Test Split:** Randomly distribute the unified dataset into 70/20/10 splits.
5. **Augmentation:** Apply Albumentations (speckle noise, contrast) to the training set only.
6. **YOLO YAML Generation:** Create a `data.yaml` pointing to the unified directories.
