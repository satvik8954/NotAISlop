# EchoTrace SSS Data Preparation Pipeline

## 1. Overview
This pipeline outlines the process of unifying four distinct Side-Scan Sonar (SSS) datasets into a single, perfectly balanced, YOLO-formatted dataset (`dataset_final`).

Because side-scan sonar imagery is highly prone to false positives from natural acoustic clutter (rocks, sand ripples), this pipeline heavily emphasizes **Hard Negative Mining** (implicit clutter) and **Explicit Clutter** classification.

## 2. Prerequisites
Before running the final dataset builder, ensure your environment is set up.

### Environment & Libraries
* **Python 3.8+**
* Required Python packages:
  ```bash
  pip install Pillow opencv-python
  ```
## 1. Prerequisites

Run the commands below from the repository root (`NotAISlop`). Windows users can use `py -3`; `python` is also fine when it points to Python 3.8 or newer.

```powershell
py -3 --version
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
py -3 -m pip install --upgrade pip
py -3 -m pip install Pillow opencv-python numpy
```

Additional packages are needed only for downloading through their APIs:

```powershell
py -3 -m pip install -U huggingface_hub
py -3 -m pip install roboflow
```

The final builder itself requires Pillow. Internet access and enough local disk space are required for the source archives and generated output. Do not commit the downloaded datasets or `dataset_final/`; they are large generated artifacts.

## 2. Obtain the source datasets

The authoritative links and dataset notes are in [`data/README.md`](data/README.md). Keep only SSS detection data; do not substitute camera, FLS, DIDSON, or classification-only datasets.

### AI4Shipwrecks

Download the AI4Shipwrecks archive from the Deep Blue link in `data/README.md`, extract it, and arrange the result as:

```text
data/AI4Shipwrecks/
   train/images/*.png
   train/masks/*.png
   test/images/*.png
   test/masks/*.png
   extras/terrain/images/*.png       # optional hard negatives
```

Convert the masks to one YOLO box per wreck image:

```powershell
py -3 train/masks_to_boxes.py --root data/AI4Shipwrecks
```

This creates `boxes/` beside each `masks/` directory. The final builder reads those generated box files.

### SubPipe Mini2

Download `SubPipeMini2.zip` from the Zenodo link in `data/README.md`. Extract the ZIP64 archive to exactly:

```text
data/SubPipeMini2/SubPipeMiniSSS/DATA/
   SSS_HF_images/Image/*.pbm
   SSS_HF_images/YOLO_Annotation/*.txt
   SSS_LF_images/Image/*.pbm
   SSS_LF_images/YOLO_Annotation/*.txt
```

Do not use `SubPipeMini` (camera segmentation) or the full 28 GB `SubPipe` dump for this pipeline. The builder converts PBM images to RGB JPEG files automatically.

### Gavia MILCO/NOMBO

Download one or more of the Gavia SSS ZIP files from Figshare, using the direct links in `data/README.md`. For the Roboflow export used by the current layout, place the extracted YOLO dataset at:

```text
data/cylinders/cylider2.v6i.yolov8/
   data.yaml
   train/images/   train/labels/
   valid/images/   valid/labels/
   test/images/    test/labels/
```

The source class mapping is `0 = MILCO` and `1 = NOMBO`. The final builder maps MILCO to `cylinder` and NOMBO to `clutter`.

If downloading from Roboflow instead, provide an API key and run:

```powershell
$env:ROBOFLOW_API_KEY = "<your-key>"
py -3 train/download_roboflow_images.py --out data/cylinders/cylider2.v6i.yolov8 --keep-labels
```

Never put the API key in a file or commit it.

### GhostVision crab pots

This dataset is gated. First accept the dataset terms at the Hugging Face page listed in `data/README.md`, then authenticate:

```powershell
hf auth login
```

Alternatively set `HF_TOKEN` in the current shell. Download the complete repository with:

```powershell
py -3 train/download_hf_dataset.py
```

The expected result is:

```text
data/ghost_nets/hf/sss-crab-pot-detection-ds/
   train/metadata.jsonl
   valid/metadata.jsonl
   test/metadata.jsonl
   train/*.jpg or *.png
   valid/*.jpg or *.png
   test/*.jpg or *.png
```

The JSONL files provide pixel-coordinate bounding boxes. The final builder reads the image dimensions and converts them to normalized YOLO coordinates.

## 3. Check prerequisites before building

From the repository root, confirm that these directories exist:

```powershell
Test-Path data/AI4Shipwrecks/train/images
Test-Path data/AI4Shipwrecks/train/boxes
Test-Path data/SubPipeMini2/SubPipeMiniSSS/DATA/SSS_HF_images/Image
Test-Path data/cylinders/cylider2.v6i.yolov8/train/images
Test-Path data/ghost_nets/hf/sss-crab-pot-detection-ds/train/metadata.jsonl
```

Every command should return `True`. A missing source is silently skipped by the builder, so these checks prevent accidentally creating an incomplete dataset.

## 4. Build the final dataset

Use `build_final_balanced_optimal.py` as the canonical builder:

```powershell
py -3 build_final_balanced_optimal.py
```

The script:

1. Reads all available source records using the mappings above.
2. Converts GhostVision boxes to YOLO format and SubPipe PBM images to JPEG.
3. Samples at most 200 records per class, including up to 200 background hard negatives.
4. Uses a deterministic random seed (`42`) and assigns an approximately 80/10/10 train/validation/test split.
5. Writes `dataset_final/{train,val,test}/{images,labels}/` and `dataset_final/data.yaml`.

The output class IDs are:

```text
0 shipwreck
1 pipe
2 cylinder
3 ghost_gear
4 clutter
```

The builder derives paths from its own location, so it can be run from any working directory inside a checkout.

## 5. Validate the result

Check that every image has a matching label file, including empty files for backgrounds:

```powershell
py -3 -m py_compile build_final_balanced_optimal.py train/masks_to_boxes.py
Get-ChildItem dataset_final -Recurse -File | Measure-Object
Get-ChildItem dataset_final/train/images -File | Measure-Object
Get-ChildItem dataset_final/train/labels -File | Measure-Object
Get-Content dataset_final/data.yaml
```

For a quick visual check, inspect a few files from each output split. Empty label files are intentional: they represent hard-negative seafloor images and must remain paired with their images.

## 6. Other builders

`build_final_dataset.py` creates an older unbalanced `unified_dataset/` output, and `build_optimal_dataset.py` creates the earlier `unified_dataset_optimal/` output. They are retained for comparison and are not the recommended final-dataset path.

## 7. Publish the data-preparation code

Commit the scripts and documentation, but keep downloaded data, virtual environments, caches, and generated datasets out of Git. Review the staged file list before pushing:

```powershell
git add data_preparation_pipeline.md build_final_balanced_optimal.py build_final_dataset.py build_optimal_dataset.py curate_dataset.py extract_and_balance.py train/download_hf_dataset.py train/download_roboflow_images.py train/extract_truncated_zip.py train/masks_to_boxes.py train/sample_remote_zip.py train/setup_detection_dataset.py
git status --short
git diff --cached --check
git commit -m "Document and publish SSS data preparation pipeline"
git push origin main
```

Do not use `git add .` for this repository unless large data files have been explicitly excluded. Before pushing, verify that no `.zip`, image corpus, token, `.venv/`, or `dataset_final/` path appears in `git diff --cached --name-only`.
