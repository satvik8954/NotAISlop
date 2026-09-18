import json
from pathlib import Path

from ultralytics import YOLO


REPO_ROOT = Path(__file__).resolve().parent
DATA_YAML = REPO_ROOT / "dataset_yolov9" / "data.yaml"
RUNS_DIR = REPO_ROOT / "runs" / "detect"
CLASS_NAMES = ["shipwreck", "pipe", "cylinder", "ghost_gear", "clutter"]
TEST_EVAL_CONFIDENCE = 0.001
BACKGROUND_CONFIDENCE = 0.25


def _background_images(data_root):
    image_dir = data_root / "test" / "images"
    label_dir = data_root / "test" / "labels"
    image_suffixes = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}
    return [
        image_path
        for image_path in sorted(image_dir.iterdir())
        if image_path.suffix.lower() in image_suffixes
        and (
            not (label_dir / f"{image_path.stem}.txt").exists()
            or not (label_dir / f"{image_path.stem}.txt").read_text().strip()
        )
    ]


def evaluate_test_set(weights_path, data_yaml, run_dir):
    best_model = YOLO(str(weights_path))
    metrics = best_model.val(
        data=str(data_yaml),
        split="test",
        imgsz=640,
        batch=4,
        workers=4,
        conf=TEST_EVAL_CONFIDENCE,
        plots=True,
        save_json=True,
        project=str(run_dir.parent),
        name=f"{run_dir.name}_test",
        exist_ok=True,
    )

    precision = float(metrics.box.mp)
    recall = float(metrics.box.mr)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    class_ap50 = {class_name: None for class_name in CLASS_NAMES}
    for class_index, ap50 in zip(metrics.box.ap_class_index, metrics.box.ap50):
        class_ap50[CLASS_NAMES[int(class_index)]] = float(ap50)

    background_paths = _background_images(Path(data_yaml).parent)
    background_predictions = 0
    for result in best_model.predict(
        source=background_paths,
        imgsz=640,
        conf=BACKGROUND_CONFIDENCE,
        stream=True,
        verbose=False,
    ):
        background_predictions += len(result.boxes)

    evaluation_dir = Path(metrics.save_dir)
    report = {
        "weights": str(weights_path),
        "split": "test",
        "evaluation_confidence_threshold": TEST_EVAL_CONFIDENCE,
        "background_confidence_threshold": BACKGROUND_CONFIDENCE,
        "mAP@0.5": float(metrics.box.map50),
        "mAP@0.5:0.95": float(metrics.box.map),
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "per_class_AP@0.5": class_ap50,
        "background_images": len(background_paths),
        "background_false_positives": background_predictions,
        "background_false_positives_per_image": (
            background_predictions / len(background_paths) if background_paths else 0.0
        ),
        "confusion_matrix": str(evaluation_dir / "confusion_matrix.png"),
        "normalized_confusion_matrix": str(
            evaluation_dir / "confusion_matrix_normalized.png"
        ),
    }
    report_path = evaluation_dir / "test_metrics.json"
    report_path.write_text(json.dumps(report, indent=2))

    print(json.dumps(report, indent=2))
    print(f"Test metrics saved to: {report_path}")
    return report

def train_model_locally():
    # Load the YOLOv9-C architecture
    model = YOLO('yolov9c.pt') 

    print("Starting local YOLOv9-C Training...")
    results = model.train(
        data=str(DATA_YAML),
        epochs=150,
        imgsz=640,
        
        # --- LOCAL HARDWARE PROTECTIONS ---
        batch=4,            # Lower batch size to prevent GPU Out-Of-Memory (OOM) crashes.
        workers=4,          # Limits CPU threads to prevent freezing.
        patience=25,        # Early stopping if no improvement after 25 epochs.
        amp=True,           # Automatic Mixed Precision to cut RAM usage.
        
        # --- Architecture & Loss Optimizations ---
        cls=1.5,            # Increase overall classification loss weight
        
        # --- Data Augmentation ---
        mosaic=1.0,         # 100% probability to use Mosaic (vital for scale variance)
        scale=0.5,          # Multi-scale training (+/- 50% image scaling)
        fliplr=0.5,         # Safe: Horizontal flip (doesn't break shadow physics)
        flipud=0.0,         # DANGER: Vertical flip disabled (preserves acoustic shadows)
        degrees=0.0,        # DANGER: Rotations disabled (preserves shadow direction)
        hsv_v=0.2           # Simulating ~20% speckle intensity variation
    )
    run_dir = Path(model.trainer.save_dir)
    best_weights = run_dir / "weights" / "best.pt"
    if not best_weights.exists():
        raise FileNotFoundError(f"Best model was not saved at {best_weights}")

    print(f"Training Complete. Best model: {best_weights}")
    evaluate_test_set(best_weights, DATA_YAML, run_dir)

if __name__ == '__main__':
    train_model_locally()
