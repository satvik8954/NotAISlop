"""Fetch a few files from a remote ZIP (HTTP range) without downloading the archive."""

from __future__ import annotations

import argparse
from pathlib import Path

from remotezip import RemoteZip


def pick_subpipe_pairs(names: list[str], n: int) -> list[tuple[str, str]]:
    labels = [p for p in names if "/YOLO_Annotation/" in p.replace("\\", "/") and p.endswith(".txt")]
    images = {Path(p).stem: p for p in names if "/Image/" in p.replace("\\", "/")}
    pairs: list[tuple[str, str]] = []
    step = max(1, len(labels) // max(n, 1))
    for lab in labels[::step]:
        img = images.get(Path(lab).stem)
        if img:
            pairs.append((img, lab))
        if len(pairs) >= n:
            break
    return pairs[:n]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--n", type=int, default=5)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    with RemoteZip(args.url) as zf:
        names = zf.namelist()
        print(f"entries={len(names)}")
        yolo = sum(1 for p in names if "YOLO_Annotation" in p and p.endswith(".txt"))
        imgs = sum(1 for p in names if "/Image/" in p.replace("\\", "/"))
        print(f"yolo_txt={yolo} images={imgs}")
        print("sample paths:")
        for p in names[:8]:
            print(" ", p)

        pairs = pick_subpipe_pairs(names, args.n)
        if not pairs:
            print("no Image/YOLO_Annotation pairs found")
            return

        nonempty = 0
        for img_name, lab_name in pairs:
            lab_bytes = zf.read(lab_name)
            text = lab_bytes.decode("utf-8", errors="ignore").strip()
            img_path = args.out / Path(img_name).name
            lab_path = args.out / (Path(img_name).stem + ".txt")
            img_path.write_bytes(zf.read(img_name))
            lab_path.write_bytes(lab_bytes)
            boxes = len([ln for ln in text.splitlines() if ln.strip()])
            nonempty += int(boxes > 0)
            print(f"saved {img_path.name} bytes={img_path.stat().st_size} boxes={boxes}")
            if text:
                print("  label:", text.splitlines()[0][:120])
        print(f"pairs={len(pairs)} with_boxes={nonempty}")


if __name__ == "__main__":
    main()
