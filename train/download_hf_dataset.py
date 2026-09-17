"""Download an entire dataset repository from Hugging Face Hub."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


DEFAULT_REPO = "PINGEcosystem/sss-crab-pot-detection-ds"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-id", default=DEFAULT_REPO)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/ghost_nets/hf/sss-crab-pot-detection-ds"),
        help="Destination directory for the complete dataset.",
    )
    parser.add_argument(
        "--revision",
        default=None,
        help="Hub branch, tag, or commit. Defaults to the repository default.",
    )
    parser.add_argument(
        "--token",
        default=os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN"),
        help="Hugging Face token. Prefer HF_TOKEN or `hf auth login` instead.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=8,
        help="Number of concurrent file downloads (default: 8).",
    )
    return parser.parse_args()


def main(args: argparse.Namespace) -> int:
    if args.workers < 1:
        print("--workers must be at least 1", file=sys.stderr)
        return 2

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("Install the Hub client first: py -3 -m pip install -U huggingface_hub", file=sys.stderr)
        return 2

    args.out.mkdir(parents=True, exist_ok=True)
    print(f"Downloading the complete dataset {args.repo_id} to {args.out.resolve()}")
    print("Existing files are reused; interrupted downloads can be run again safely.")
    try:
        snapshot_download(
            repo_id=args.repo_id,
            repo_type="dataset",
            revision=args.revision,
            token=args.token,
            local_dir=str(args.out),
            max_workers=args.workers,
        )
    except Exception as exc:  # noqa: BLE001 - present a useful CLI error for Hub failures
        print(f"Download failed: {exc}", file=sys.stderr)
        print(
            "For gated datasets, accept the dataset terms in your browser and authenticate "
            "with `hf auth login` or HF_TOKEN.",
            file=sys.stderr,
        )
        return 1

    print(f"Download complete: {args.out.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(parse_args()))