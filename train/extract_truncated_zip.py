"""Extract complete members from a truncated ZIP (central directory missing)."""

from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path

LOCAL_SIG = b"PK\x03\x04"
DESC_SIG = b"PK\x07\x08"


def _skip_descriptor(f, size: int) -> bool:
    pos = f.tell()
    if pos + 4 > size:
        return False
    sig = f.read(4)
    if sig == DESC_SIG:
        rest = f.read(12)
        return len(rest) == 12
    f.seek(pos)
    rest = f.read(12)
    return len(rest) == 12


def _inflate_until_eof(f, size: int) -> bytes | None:
    dec = zlib.decompressobj(-15)
    chunks: list[bytes] = []
    while True:
        pos = f.tell()
        if pos >= size:
            return None
        buf = f.read(min(65536, size - pos))
        if not buf:
            return None
        try:
            chunks.append(dec.decompress(buf))
        except zlib.error:
            return None
        if dec.unused_data:
            f.seek(pos + len(buf) - len(dec.unused_data))
            return b"".join(chunks)
        if dec.eof:
            return b"".join(chunks)


def extract_truncated_zip(zip_path: Path, dest: Path) -> tuple[int, int]:
    dest.mkdir(parents=True, exist_ok=True)
    size = zip_path.stat().st_size
    extracted = skipped = 0
    with zip_path.open("rb") as f:
        while True:
            start = f.tell()
            hdr = f.read(30)
            if len(hdr) < 30 or hdr[:4] != LOCAL_SIG:
                break
            _ver, flags, method, _t, _d, _crc, csize, usize, nlen, elen = struct.unpack(
                "<HHHHHIIIHH", hdr[4:30]
            )
            name = f.read(nlen)
            extra = f.read(elen)
            if len(name) < nlen or len(extra) < elen:
                break
            rel = name.decode("utf-8", errors="replace").replace("\\", "/")
            if rel.endswith("/"):
                (dest / rel).mkdir(parents=True, exist_ok=True)
                skipped += 1
                continue

            data: bytes | None
            if flags & 0x08:
                if method == 8:
                    data = _inflate_until_eof(f, size)
                    if data is None:
                        break
                    if not _skip_descriptor(f, size):
                        break
                elif method == 0:
                    break
                else:
                    break
            else:
                remaining = size - f.tell()
                if csize > remaining:
                    break
                payload = f.read(csize)
                if method == 0:
                    data = payload
                elif method == 8:
                    try:
                        data = zlib.decompress(payload, -15)
                    except zlib.error:
                        break
                else:
                    skipped += 1
                    continue

            out = dest / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(data)
            extracted += 1
            if extracted % 100 == 0:
                print(f"extracted={extracted} last={rel} offset={start}")
    return extracted, skipped


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--zip", type=Path, required=True)
    p.add_argument("--dest", type=Path, required=True)
    args = p.parse_args()
    n, skip = extract_truncated_zip(args.zip, args.dest)
    print(f"done extracted={n} dirs_or_skipped={skip}")


if __name__ == "__main__":
    main()
