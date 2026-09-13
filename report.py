"""
report.py
Turns filtered detections into the structured JSON/CSV report the
architecture calls for. Real side-scan sonar logs (.xtf/.jsf) carry
per-ping GPS + heading, which ingest.py would parse; the sample PNG/JPG
chips pulled from the repo have no such navigation metadata attached.
So: real pixel/image data everywhere, and geo-coordinates only when a
nav track is supplied -- otherwise each record is explicitly flagged
'geotag: not_available_no_nav_metadata' rather than a made-up lat/long.
"""
import os, json, csv, datetime


def pixel_to_latlon(bbox, img_shape, nav_track=None):
    """If a nav_track (start_lat, start_lon, end_lat, end_lon) is given,
    linearly interpolate the detection's position along it based on its
    row position in the image. Returns None if no nav is available."""
    if nav_track is None:
        return None
    x1, y1, x2, y2 = bbox
    h, w = img_shape
    if h == 0:
        return None
    cy = (y1 + y2) / 2 / h  # 0..1 along the sonar track
    lat = nav_track["start_lat"] + cy * (nav_track["end_lat"] - nav_track["start_lat"])
    lon = nav_track["start_lon"] + cy * (nav_track["end_lon"] - nav_track["start_lon"])
    return {"lat": round(lat, 6), "lon": round(lon, 6)}


def build_report(image_path, detections, img_shape, nav_track=None):
    records = []
    base_name = os.path.basename(image_path)
    for i, d in enumerate(detections):
        geo = pixel_to_latlon(d["bbox"], img_shape, nav_track)
        records.append({
            "detection_id": f"{base_name}_{i}",
            "source_image": image_path,
            "class": d["class"],
            "confidence": d["confidence"],
            "raw_confidence": d.get("raw_confidence"),
            "shadow_multiplier": d.get("shadow_multiplier"),
            "bbox_px": d["bbox"],
            "geotag": geo if geo is not None else "not_available_no_nav_metadata",
            "detected_at": datetime.datetime.utcnow().isoformat() + "Z",
        })
    return records


def write_json(records, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(records, f, indent=2)


def write_csv(records, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not records:
        with open(path, "w") as f:
            f.write("")
        return
    fields = list(records[0].keys())
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in records:
            writer.writerow(r)
