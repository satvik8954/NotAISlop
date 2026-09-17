"""Build a YOLO detection set from local SSS sources that already have boxes or masks."""

from __future__ import annotations

import argparse
import hashlib
import shutil
import zipfile
from pathlib import Path

from PIL import Image

CLASS_NAMES = ["shipwreck", "pipe", "cylinder"]
CLASS_SHIPWRECK = 0
CLASS_PIPE = 1
CLASS_CYLINDER = 2


def hardlink_or_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return
    try:
        dst.hardlink_to(src)
    except OSError:
        shutil.copy2(src, dst)


def remap_yolo(src: Path, dst: Path, class_map: dict[int, int], drop_unmapped: bool = True) -> int:
    lines_out: list[str] = []
    text = src.read_text(encoding="utf-8", errors="ignore").strip()
    if text:
        for raw in text.splitlines():
            parts = raw.split()
            if len(parts) < 5:
                continue
            src_cls = int(float(parts[0]))
            if src_cls not in class_map:
                if drop_unmapped:
                    continue
                continue
            parts[0] = str(class_map[src_cls])
            lines_out.append(" ".join(parts))
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(("\n".join(lines_out) + ("\n" if lines_out else "")), encoding="utf-8")
    return len(lines_out)


def convert_image(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return
    if src.suffix.lower() in {".png", ".jpg", ".jpeg"}:
        hardlink_or_copy(src, dst)
        return
    with Image.open(src) as im:
        im.convert("L").save(dst)


def extract_zip(zip_path: Path, dest: Path) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    marker = dest / ".extracted"
    if marker.exists():
        return
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(dest)
    marker.write_text("ok\n", encoding="utf-8")


def split_name(stem: str, val_ratio: float = 0.2) -> str:
    h = int(hashlib.md5(stem.encode("utf-8")).hexdigest(), 16)
    return "val" if (h % 1000) / 1000 < val_ratio else "train"


def add_pair(
    image_src: Path,
    label_src: Path | None,
    class_map: dict[int, int],
    out_root: Path,
    prefix: str,
    split: str,
) -> bool:
    stem = f"{prefix}_{image_src.stem}"
    img_dst = out_root / "images" / split / f"{stem}.png"
    lbl_dst = out_root / "labels" / split / f"{stem}.txt"
    convert_image(image_src, img_dst)
    n = 0
    if label_src and label_src.exists():
        n = remap_yolo(label_src, lbl_dst, class_map)
    else:
        lbl_dst.parent.mkdir(parents=True, exist_ok=True)
        lbl_dst.write_text("", encoding="utf-8")
    return n > 0


def collect_subpipe(extracted: Path) -> list[tuple[Path, Path]]:
    pairs: list[tuple[Path, Path]] = []
    for yolo_dir in extracted.rglob("YOLO_Annotation"):
        img_dir = yolo_dir.parent / "Image"
        if not img_dir.is_dir():
            continue
        by_stem = {p.stem: p for p in img_dir.iterdir() if p.is_file()}
        for label in yolo_dir.glob("*.txt"):
            img = by_stem.get(label.stem)
            if img is not None:
                pairs.append((img, label))
    return pairs


def collect_gavia(extracted: Path) -> list[tuple[Path, Path]]:
    pairs: list[tuple[Path, Path]] = []
    for img in extracted.rglob("*"):
        if img.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        label = img.with_suffix(".txt")
        if not label.exists():
            # some dumps keep labels beside images with same stem
            alt = img.parent / f"{img.stem}.txt"
            label = alt if alt.exists() else None
        if label and label.exists():
            pairs.append((img, label))
    return pairs


def copy_class_flat(pairs: list[tuple[Path, Path]], dest_images: Path, dest_labels: Path, class_map: dict[int, int], prefix: str) -> tuple[int, int]:
    dest_images.mkdir(parents=True, exist_ok=True)
    dest_labels.mkdir(parents=True, exist_ok=True)
    n_img = n_pos = 0
    for img, lab in pairs:
        stem = f"{prefix}_{img.stem}"
        convert_image(img, dest_images / f"{stem}.png")
        n = remap_yolo(lab, dest_labels / f"{stem}.txt", class_map)
        n_img += 1
        if n:
            n_pos += 1
    return n_img, n_pos


def write_yaml(out_root: Path) -> None:
    names = ", ".join(f"{i}: {n}" for i, n in enumerate(CLASS_NAMES))
    text = (
        f"path: {out_root.resolve().as_posix()}\n"
        "train: images/train\n"
        "val: images/val\n"
        f"names:\n" + "".join(f"  {i}: {n}\n" for i, n in enumerate(CLASS_NAMES))
    )
    (out_root / "data.yaml").write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("data"))
    args = parser.parse_args()
    root = args.root
    downloads = root / "_downloads"
    yolo = root / "yolo"
    stats: dict[str, str] = {}

    # --- shipwrecks (masks already converted to boxes) ---
    wreck_pairs: list[tuple[Path, Path, str]] = []
    for split_src, split_dst in (("train", "train"), ("test", "val")):
        img_dir = root / "AI4Shipwrecks" / split_src / "images"
        box_dir = root / "AI4Shipwrecks" / split_src / "boxes"
        if not img_dir.is_dir():
            continue
        for img in sorted(img_dir.glob("*.png")):
            box = box_dir / f"{img.stem}.txt"
            wreck_pairs.append((img, box, split_dst))
    wreck_pos = 0
    for img, box, split in wreck_pairs:
        if add_pair(img, box if box.exists() else None, {0: CLASS_SHIPWRECK}, yolo, "wreck", split):
            wreck_pos += 1
    wreck_dir_img = root / "shipwrecks" / "images"
    wreck_dir_lbl = root / "shipwrecks" / "labels"
    wreck_dir_img.mkdir(parents=True, exist_ok=True)
    wreck_dir_lbl.mkdir(parents=True, exist_ok=True)
    for img, box, _ in wreck_pairs:
        convert_image(img, wreck_dir_img / f"{img.stem}.png")
        if box.exists():
            remap_yolo(box, wreck_dir_lbl / f"{img.stem}.txt", {0: 0})
        else:
            (wreck_dir_lbl / f"{img.stem}.txt").write_text("", encoding="utf-8")
    stats["shipwreck"] = f"{len(wreck_pairs)} images, {wreck_pos} with boxes"

    # --- pipes ---
    pipe_zip = downloads / "SubPipeMini2.zip"
    pipe_extract = downloads / "SubPipeMini2"
    pipe_pairs: list[tuple[Path, Path]] = []
    if pipe_zip.exists() and pipe_zip.stat().st_size > 1_000_000:
        extract_zip(pipe_zip, pipe_extract)
        pipe_pairs = collect_subpipe(pipe_extract)
        n_img, n_pos = copy_class_flat(
            pipe_pairs,
            root / "pipes" / "images",
            root / "pipes" / "labels",
            {0: 0, 1: 0},
            "pipe",
        )
        for img, lab in pipe_pairs:
            split = split_name(img.stem)
            add_pair(img, lab, {0: CLASS_PIPE, 1: CLASS_PIPE}, yolo, "pipe", split)
        stats["pipe"] = f"{n_img} images, {n_pos} with boxes"
    else:
        stats["pipe"] = "SubPipeMini2.zip missing"

    # --- cylinders ---
    gavia_root = downloads / "gavia"
    gavia_root.mkdir(parents=True, exist_ok=True)
    for z in sorted(downloads.glob("gavia_*.zip")):
        extract_zip(z, gavia_root / z.stem)
    cyl_pairs = collect_gavia(gavia_root)
    if not cyl_pairs:
        # keep existing samples as fallback
        sample_dir = root / "cylinders" / "samples"
        for img in sample_dir.glob("*.jpg"):
            lab = img.with_suffix(".txt")
            if lab.exists():
                cyl_pairs.append((img, lab))
    n_img, n_pos = copy_class_flat(
        cyl_pairs,
        root / "cylinders" / "images",
        root / "cylinders" / "labels",
        {0: 0},
        "cyl",
    )
    for img, lab in cyl_pairs:
        split = split_name(img.stem)
        add_pair(img, lab, {0: CLASS_CYLINDER}, yolo, "cyl", split)
    stats["cylinder"] = f"{n_img} images, {n_pos} with MILCO boxes (NOMBO dropped)"

    write_yaml(yolo)
    print("ready:", yolo / "data.yaml")
    for k, v in stats.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
