# Side-scan sonar (SSS) data only

This folder is **SSS only**. No forward-looking sonar (FLS), DIDSON, camera, or RGB underwater photos.

Layout:

```
data/
  shipwrecks/samples/   SSS wreck chips
  pipes/samples/        SSS pipeline chips
  cylinders/samples/    SSS mine-like contacts (cylinder proxy) + YOLO labels
  ghost_nets/           SSS ghost-gear links (Hugging Face is gated; no file copied)
```

Samples below are a few files so you can inspect texture. They are **not** the training set.

---

## shipwrecks

| | |
| --- | --- |
| **Full labeled set (preferred)** | **AI4Shipwrecks** — 286 SSS waterfalls, pixel masks, EdgeTech 2205 |
| Page | https://umfieldrobotics.github.io/ai4shipwrecks/download/ |
| Deep Blue | https://deepblue.lib.umich.edu/data/concern/data_sets/8623hz41x |
| Zip (1.13 GB) | https://deepblue.lib.umich.edu/data/downloads/db78tc698 |
| Scripts repo | https://github.com/umfieldrobotics/ai4shipwrecks-scripts |
| **Sample in this repo** | `samples/ship-303.png`, `ship-307.png`, `ship-310.png` |
| Sample source | **SeabedObjects-KLSG** real SSS ship chips (GitHub; AI4 zip is Cloudflare-blocked from this environment) |
| Sample zip | https://github.com/huoguanying/SeabedObjects-Ship-and-Airplane-dataset/raw/master/ship-real-3.zip |
| Dataset repo | https://github.com/huoguanying/SeabedObjects-Ship-and-Airplane-dataset |

AI4 labels: PNG mask, `0` = seafloor, `1` = wreck. **161 / 286** images contain a wreck.
YOLO boxes (one tight box per mask, class `0` = wreck) are written next to the masks:

```
py -3 train/masks_to_boxes.py --root data/AI4Shipwrecks
```

Output: `data/AI4Shipwrecks/{train,test,extras/terrain}/boxes/*.txt`

**SeabedObjects-KLSG** is SSS chips with **no boxes and no masks** (image-level class only). Do not use it for detection.

```bash
curl -L -o AI4Shipwrecks.zip "https://deepblue.lib.umich.edu/data/downloads/db78tc698"
```

---

## pipes

| | |
| --- | --- |
| **Full labeled set (preferred)** | **SubPipe** SSS object detection — 10,030 images, 6,335 YOLO/COCO boxes |
| Zenodo v3 | https://zenodo.org/records/12666132 |
| **SSS-only subset (4.9 GB)** | https://zenodo.org/records/12666132/files/SubPipeMini2.zip?download=1 |
| Full dump (28 GB, includes cameras — skip unless you need nav) | https://zenodo.org/records/12666132/files/SubPipe.zip?download=1 |
| Docs | https://github.com/remaro-network/SubPipe-dataset |
| **Sample in this repo** | `samples/s1.jpg`, `s2.jpg`, `s101.jpg` |
| Sample source | **Marine PULSE** SSS class `pipeline or cable` (strictly SSS chips; SubPipe Mini2 is a 4.9 GB ZIP64 archive) |
| Marine PULSE zip | https://zenodo.org/records/7922705/files/Marine_PULSE.zip?download=1 |
| Marine PULSE record | https://zenodo.org/records/7922705 |

Use **SubPipeMini2**, not SubPipeMini (Mini is camera segmentation). Folder in the full set: `SSS_HF_images/` and `SSS_LF_images/` with `YOLO_Annotation/` and `COCO_Annotation/`.

**Marine PULSE** is SSS chips with **no boxes and no masks** (folder-level classification). Do not use it for detection. Keep SubPipe Mini2 only.

```bash
curl -L -o SubPipeMini2.zip "https://zenodo.org/records/12666132/files/SubPipeMini2.zip?download=1"
```

---

## cylinders

No public SSS set is named “cylinder”. Proxy = **mine-like contacts (MILCO)** on Gavia AUV SSS.

| | |
| --- | --- |
| **Full labeled set** | 1,170 SSS images, YOLO boxes |
| Figshare | https://figshare.com/articles/dataset/_i_Side-scan_sonar_imaging_for_Mine_detection_i_/24574879 |
| **Sample in this repo** | `samples/0001_2021.jpg` (+ `.txt`), `0003_2021.jpg`, `0007_2021.jpg` from year 2021 |
| Label format | YOLO: class `0` = MILCO (use as cylinder), class `1` = NOMBO (clutter) |

Direct zips (SSS jpeg + txt):

- 2010: https://ndownloader.figshare.com/files/43169008
- 2015: https://ndownloader.figshare.com/files/43169002
- 2017: https://ndownloader.figshare.com/files/43169005
- 2018: https://ndownloader.figshare.com/files/43169011
- 2021: https://ndownloader.figshare.com/files/43168999

Do **not** use the FLS UXO / ARIS marine-debris sets.

```bash
curl -L -o gavia_2021.zip "https://ndownloader.figshare.com/files/43168999"
```

---

## ghost_nets (SSS ghost gear)

There is **no open SSS net-mask dump** we could copy without a Hugging Face license click-through.

| | |
| --- | --- |
| SSS derelict **crab pots** (ghost gear, not mesh nets) | https://huggingface.co/datasets/PINGEcosystem/sss-crab-pot-detection-ds |
| Same project | https://github.com/PINGEcosystem/GhostVision |
| GhostNetZero nets (SSS patches; request/paper) | https://www.microsoft.com/en-us/research/wp-content/uploads/2025/09/GhostNetAI_TechReport.pdf |

Accept the HF dataset terms, then:

```bash
huggingface-cli download PINGEcosystem/sss-crab-pot-detection --repo-type dataset --local-dir data/ghost_nets/hf
```

Those files are Humminbird **side-scan** imagery.

---

## Catalog (links only, no FLS)

https://github.com/remaro-network/OpenSonarDatasets — table of datasets. For this project keep SSS rows only: AI4Shipwreck, SubPipe, SSS Mine Detection, Marine_PULSE, SeabedObjects-KLSG. Skip UATD, UXO, MDT, DIDSON (not SSS).

---

## Detection sets only (SSS + boxes, or SSS masks converted to boxes)

Only links already listed above. Skip classification-only chips and camera/FLS dumps.

| Class | Keep | Skip | Labels for detection |
| --- | --- | --- | --- |
| shipwreck | AI4Shipwrecks | SeabedObjects-KLSG (no box/mask) | masks → YOLO in `boxes/` |
| pipe | SubPipe Mini2 | Marine PULSE (no box/mask); full SubPipe (cameras); SubPipeMini (camera) | native YOLO/COCO boxes |
| cylinder | Gavia MILCO/NOMBO | — | native YOLO boxes |
| ghost gear | GhostVision HF crab pots | GhostNetZero (paper only; SSS masks exist but no public dump in this README) | native JSONL boxes |

## Counts (detection-ready SSS sets, not the samples)

| Class | Dataset | SSS images | Labels |
| --- | --- | --- | --- |
| shipwreck | AI4Shipwrecks | 286 | masks → boxes (161 positive) |
| pipe | SubPipe Mini2 | 10,030 | 6,335 boxes |
| cylinder proxy | Gavia MILCO/NOMBO | 1,170 | 432 MILCO + 235 NOMBO boxes |
| ghost gear | GhostVision HF | 6,674 (after license) | JSONL boxes |
