"""Download Roboflow images matching a class from a dataset version.

The Roboflow Universe browse page is interactive and may be protected by
Cloudflare. This script uses the supported Roboflow SDK instead.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-key", default=os.getenv("ROBOFLOW_API_KEY"))
    parser.add_argument("--workspace", default="yeesonmin-naver-com")
    parser.add_argument("--project", default="cylider2")
    parser.add_argument("--version", type=int, default=6)
    parser.add_argument("--class-name", default="cylinder")
    parser.add_argument("--out", type=Path, default=Path("data/roboflow_cylinder"))
    parser.add_argument(
        "--format",
        default="yolov8",
        choices=("yolov5", "yolov8", "coco"),
        help="Annotation format downloaded from Roboflow (default: yolov8).",
    )
    parser.add_argument("--keep-labels", action="store_true")
    return parser.parse_args()


def class_id_from_yaml(dataset_dir: Path, class_name: str) -> int:
    yaml_path = dataset_dir / "data.yaml"
    if not yaml_path.exists():
        raise FileNotFoundError(f"Roboflow download did not contain {yaml_path}")

    # Roboflow's data.yaml uses a simple numeric mapping. Avoid adding a YAML
    # dependency just to read this small, predictable section.
    names: dict[int, str] = {}
    in_names = False
    list_index = 0
    for raw_line in yaml_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line == "names:":
            in_names = True
            continue
        if line.startswith("names:"):
            inline_names = line.split(":", 1)[1].strip().strip("[]")
            for value in inline_names.split(","):
                value = value.strip().strip("'\"")
                if value:
                    names[list_index] = value
                    list_index += 1
            in_names = False
            continue
        if in_names and ":" in line:
            key, value = line.split(":", 1)
            try:
                names[int(key.strip())] = value.strip().strip("'\"")
            except ValueError:
                pass
        elif in_names and line.startswith("-"):
            names[list_index] = line[1:].strip().strip("'\"")
            list_index += 1
        elif in_names and line and not line.startswith("#"):
            break

    for class_id, name in names.items():
        if name.casefold() == class_name.casefold():
            return class_id
    raise ValueError(f"Class {class_name!r} not found in {yaml_path}; found {names}")


def image_for_label(label_path: Path, image_dirs: list[Path]) -> Path | None:
    for image_dir in image_dirs:
        for suffix in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
            candidate = image_dir / f"{label_path.stem}{suffix}"
            if candidate.exists():
                return candidate
    return None


def download(args: argparse.Namespace) -> int:
    if not args.api_key:
        print(
            "Set ROBOFLOW_API_KEY or pass --api-key. Create a key in Roboflow "
            "Settings > Roboflow API.",
            file=sys.stderr,
        )
        return 2

    try:
        from roboflow import Roboflow
    except ImportError:
        print("Install the SDK first: python -m pip install roboflow", file=sys.stderr)
        return 2

    staging = args.out.with_name(args.out.name + "_roboflow_download")
    args.out.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {args.workspace}/{args.project}/{args.version}...")
    dataset = (
        Roboflow(api_key=args.api_key)
        .workspace(args.workspace)
        .project(args.project)
        .version(args.version)
        .download(args.format, location=str(staging))
    )
    dataset_dir = Path(dataset.location if hasattr(dataset, "location") else staging)
    class_id = class_id_from_yaml(dataset_dir, args.class_name)
    label_dirs = [dataset_dir / "train" / "labels", dataset_dir / "valid" / "labels", dataset_dir / "test" / "labels"]
    image_dirs = [dataset_dir / split / "images" for split in ("train", "valid", "test")]

    copied = 0
    for label_dir in label_dirs:
        if not label_dir.is_dir():
            continue
        for label_path in sorted(label_dir.glob("*.txt")):
            lines = label_path.read_text(encoding="utf-8", errors="ignore").splitlines()
            if not any(line.split() and int(float(line.split()[0])) == class_id for line in lines):
                continue
            image_path = image_for_label(label_path, image_dirs)
            if image_path is None:
                print(f"warning: image missing for {label_path.name}", file=sys.stderr)
                continue
            destination = args.out / "images" / image_path.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(image_path, destination)
            if args.keep_labels:
                shutil.copy2(label_path, args.out / "labels" / label_path.name)
            copied += 1

    print(f"Saved {copied} image(s) containing class {args.class_name!r} to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(download(parse_args()))