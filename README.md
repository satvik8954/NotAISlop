# EchoTrace — AI-Powered Underwater Marine Debris & Anomaly Detection

**Smart India Hackathon 2026** · Problem Statement: *AI-Powered Automated Underwater Marine Debris and Anomaly Detection System using Side-Scan Sonar Imagery*
**Organization:** Ministry of Earth Sciences (MoES) · **Department:** National Institute of Ocean Technology (NIOT)
**Team:** EchoTrace#26

---

## Problem

Abandoned, lost, or discarded fishing gear ("ghost nets") and other man-made debris accumulate on the seafloor, killing marine life, destroying coral reefs, and damaging vessels. Conservationists rely on side-scan sonar (SSS) — towed behind ships or mounted on AUVs — to map the seafloor acoustically, but manually reviewing thousands of kilometers of sonar logs is slow and error-prone. Debris easily blends into natural seafloor features like rock formations and sand ripples.

## What we're building

An end-to-end computer vision pipeline that ingests raw side-scan sonar imagery and automatically detects, classifies, and geotags man-made debris — while filtering out false positives caused by natural acoustic clutter. Designed to run efficiently on edge hardware, with no cloud dependency required.

## Architecture

```
Side-scan sonar log (SSS / AUV input)
        │
        ▼
Pre-processing
  Speckle denoising, motion/geometric correction, tiling
        │
        ▼
Detection / segmentation
  YOLO / Faster R-CNN / U-Net — bounding boxes or pixel masks
        │
        ▼
Shadow-consistency filter   ← core differentiator
  Confidence scoring using acoustic shadow geometry to separate
  real objects from natural clutter (rocks, sand ripples)
        │
        ▼
Geotagging & report engine
  Structured JSON/CSV output — lat/long, dimensions, classification
        │
        ▼
UI dashboard
  Upload sonar logs, view detections overlaid, download reports
```

### Why the shadow-consistency filter matters

A real 3D object on the seafloor casts an acoustic shadow whose length relates directly to its height and the sonar's range/altitude:

```
object_height ≈ shadow_length × (altitude / range)
```

Detections without a shadow geometrically consistent with a plausible object are down-weighted — this is how we tell debris apart from rock clusters and terrain, which the problem statement calls out as the central technical challenge.

## Repository structure

```
echotrace/
├── ingest.py              # parse sonar logs (.xtf/.jsf/images), extract nav metadata
├── preprocess.py          # denoise, geometric correction, tiling
├── detect.py               # detection/segmentation inference
├── shadow_filter.py         # confidence scoring, shadow-consistency check
├── report.py                  # geotagged JSON/CSV report generation
├── train/
│   ├── prepare_datasets.py      # unify NOMBO/KLSG/SCTD dataset formats
│   └── train_detector.py
├── app.py                          # dashboard (Streamlit / FastAPI + frontend)
├── models/                           # trained model weights
└── data/
    ├── raw/                            # source datasets
    └── processed/
```

## Tech stack

| Layer | Tools |
|---|---|
| Detection model | PyTorch, YOLOv8/v11 or U-Net |
| Pre-processing | OpenCV, NumPy |
| Dashboard | Streamlit (or FastAPI + React) |
| Edge export | ONNX / TensorRT |
| Data | NOMBO/MILCO, SeabedObjects-KLSG, SCTD (public side-scan sonar datasets) |

## Getting started

```bash
git clone <repo-url>
cd echotrace
pip install -r requirements.txt

# Run the pipeline on a sample sonar log
python -m app
```

## Datasets (side-scan sonar only)

Inspection samples and **direct download links** live in [`data/README.md`](data/README.md). Folders:

| Class | `data/` | Full SSS set |
| --- | --- | --- |
| Shipwrecks | `data/shipwrecks/samples/` | AI4Shipwrecks (masks) + SeabedObjects chips |
| Pipes | `data/pipes/samples/` | SubPipe Mini2 (YOLO/COCO) + Marine PULSE chips |
| Cylinders | `data/cylinders/samples/` | Gavia AUV MILCO/NOMBO YOLO |
| Ghost nets / gear | `data/ghost_nets/` | GhostVision Humminbird SSS (HF license required) |

**Not used:** FLS, ARIS, DIDSON, camera RGB, UXO FLS. Sample files are a few SSS images for visual check, not the full training corpus.

## Roadmap

- [ ] Data ingestion + pre-processing pipeline
- [ ] Baseline detector trained on unified public datasets
- [ ] Shadow-consistency confidence module
- [ ] Geotagging + report generation
- [ ] Dashboard with confidence-threshold slider
- [ ] Edge deployment benchmark (ONNX/TensorRT inference speed)

## Team

EchoTrace#26 — Smart India Hackathon 2026

## License

TBD
