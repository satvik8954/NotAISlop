import argparse
import json
from pathlib import Path

from ultralytics import YOLO


CLASS_NAMES = ["shipwreck", "pipe", "cylinder", "ghost_gear", "clutter"]
EVAL_CONFIDENCE = 0.001
BACKGROUND_CONFIDENCE = 0.25
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def background_images(dataset_root):
    image_dir = dataset_root / "test" / "images"
    label_dir = dataset_root / "test" / "labels"
    return [
        image_path
        for image_path in sorted(image_dir.iterdir())
        if image_path.suffix.lower() in IMAGE_SUFFIXES
        and (
            not (label_dir / f"{image_path.stem}.txt").exists()
            or not (label_dir / f"{image_path.stem}.txt").read_text().strip()
        )
    ]


def evaluate(weights, data_yaml, output_dir, image_size, batch, workers):
    weights = Path(weights).resolve()
    data_yaml = Path(data_yaml).resolve()
    output_dir = Path(output_dir).resolve()
    dataset_root = data_yaml.parent

    if not weights.exists():
        raise FileNotFoundError(f"Weights not found: {weights}")
    if not data_yaml.exists():
        raise FileNotFoundError(f"Dataset YAML not found: {data_yaml}")

    model = YOLO(str(weights))
    metrics = model.val(
        data=str(data_yaml),
        split="test",
        imgsz=image_size,
        batch=batch,
        workers=workers,
        conf=EVAL_CONFIDENCE,
        plots=True,
        save_json=True,
        project=str(output_dir.parent),
        name=output_dir.name,
        exist_ok=True,
    )

    precision = float(metrics.box.mp)
    recall = float(metrics.box.mr)
    class_ap50 = {class_name: None for class_name in CLASS_NAMES}
    for class_index, ap50 in zip(metrics.box.ap_class_index, metrics.box.ap50):
        class_index = int(class_index)
        if class_index < len(CLASS_NAMES):
            class_ap50[CLASS_NAMES[class_index]] = float(ap50)

    backgrounds = background_images(dataset_root)
    false_positives = sum(
        len(result.boxes)
        for result in model.predict(
            source=backgrounds,
            imgsz=image_size,
            conf=BACKGROUND_CONFIDENCE,
            stream=True,
            verbose=False,
        )
    )

    evaluation_dir = Path(metrics.save_dir)
    report = {
        "weights": str(weights),
        "split": "test",
        "warning": (
            "yolov9c.pt is the pretrained COCO checkpoint; use a trained best.pt "
            "for meaningful five-class custom detection metrics."
            if weights.name == "yolov9c.pt"
            else None
        ),
        "mAP@0.5": float(metrics.box.map50),
        "mAP@0.5:0.95": float(metrics.box.map),
        "precision": precision,
        "recall": recall,
        "f1_score": 2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0,
        "per_class_AP@0.5": class_ap50,
        "background_images": len(backgrounds),
        "background_confidence_threshold": BACKGROUND_CONFIDENCE,
        "background_false_positives": false_positives,
        "background_false_positives_per_image": (
            false_positives / len(backgrounds) if backgrounds else 0.0
        ),
        "confusion_matrix": str(evaluation_dir / "confusion_matrix.png"),
        "normalized_confusion_matrix": str(
            evaluation_dir / "confusion_matrix_normalized.png"
        ),
    }
    report_path = evaluation_dir / "test_metrics.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    print(f"Metrics saved to: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate a YOLOv9 checkpoint on the test set")
    parser.add_argument("--weights", default="yolov9c.pt")
    parser.add_argument("--data", default="dataset_yolov9/data.yaml")
    parser.add_argument("--output", default="runs/detect/evaluate_yolov9c_test")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()
    evaluate(args.weights, args.data, args.output, args.imgsz, args.batch, args.workers)


if __name__ == "__main__":
    main()