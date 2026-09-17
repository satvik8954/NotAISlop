"""Convert binary SSS masks (0 = background, >0 = object) to YOLO boxes."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def mask_to_yolo_line(mask: np.ndarray, class_id: int = 0) -> str | None:
    if mask.ndim == 3:
        mask = mask[..., 0]
    ys, xs = np.where(mask > 0)
    if ys.size == 0:
        return None
    h, w = mask.shape[:2]
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    bw = x1 - x0 + 1
    bh = y1 - y0 + 1
    xc = (x0 + x1 + 1) / 2 / w
    yc = (y0 + y1 + 1) / 2 / h
    return f"{class_id} {xc:.6f} {yc:.6f} {bw / w:.6f} {bh / h:.6f}"


def convert_split(labels_dir: Path, boxes_dir: Path, class_id: int) -> tuple[int, int]:
    boxes_dir.mkdir(parents=True, exist_ok=True)
    positive = empty = 0
    for mask_path in sorted(labels_dir.glob("*.png")):
        mask = np.array(Image.open(mask_path))
        line = mask_to_yolo_line(mask, class_id)
        out = boxes_dir / (mask_path.stem + ".txt")
        if line is None:
            out.write_text("", encoding="utf-8")
            empty += 1
        else:
            out.write_text(line + "\n", encoding="utf-8")
            positive += 1
    return positive, empty


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        type=Path,
        default=Path("data/AI4Shipwrecks"),
        help="Dataset root with train/test/.../labels mask PNGs",
    )
    parser.add_argument("--class-id", type=int, default=0)
    args = parser.parse_args()

    splits = [
        args.root / "train",
        args.root / "test",
        args.root / "extras" / "terrain",
    ]
    for split in splits:
        labels = split / "labels"
        if not labels.is_dir():
            continue
        pos, empty = convert_split(labels, split / "boxes", args.class_id)
        print(f"{split}: {pos} boxes, {empty} empty")


if __name__ == "__main__":
    main()
