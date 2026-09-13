"""
train_detector.py
Trains a classical HOG + linear-SVM tile classifier on the tiled dataset
produced by prepare_datasets.py. This stands in for the YOLO/U-Net model
named in the project architecture -- with 84 pipe tiles and 18 cylinder
tiles total (that's the entirety of what's labelled and downloadable right
now), a deep detector would just memorize noise. HOG+SVM is a legitimate,
fast baseline that proves the pipeline end-to-end on real data; swap in
ultralytics YOLOv8 once GhostNetZero/SubPipe/AI4 full sets are pulled in.

Saves: models/tile_classifier.joblib  (SVM + label encoder + HOG params)
"""
import os, glob, random, json
import numpy as np
import cv2
from skimage.feature import hog
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from sklearn.preprocessing import LabelEncoder
import joblib

random.seed(42)
np.random.seed(42)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
OUT = os.path.join(REPO_ROOT, "data_prepared")
MODEL_DIR = os.path.join(REPO_ROOT, "models")
TILE = 256
HOG_PARAMS = dict(orientations=9, pixels_per_cell=(16, 16), cells_per_block=(2, 2))

CLASSES = ["background", "shipwreck", "pipe", "cylinder"]
CAP_PER_CLASS = 400  # subsample to keep classes roughly balanced


def load_tiles():
    X_paths, y = [], []
    for c in CLASSES:
        files = sorted(glob.glob(os.path.join(OUT, "tiles", c, "*.png")))
        random.shuffle(files)
        files = files[:CAP_PER_CLASS]
        X_paths += files
        y += [c] * len(files)
    return X_paths, y


def extract_features(path):
    img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
    img = cv2.resize(img, (TILE, TILE))
    img = cv2.equalizeHist(img)  # helps with sonar's low/uneven contrast
    feat = hog(img, **HOG_PARAMS)
    return feat


def run():
    paths, labels = load_tiles()
    print(f"Loaded {len(paths)} tiles across {len(set(labels))} classes")
    for c in CLASSES:
        print(f"  {c}: {labels.count(c)}")

    X = np.array([extract_features(p) for p in paths])
    le = LabelEncoder()
    y = le.fit_transform(labels)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    clf = SVC(kernel="linear", C=1.0, probability=True, class_weight="balanced")
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_val)
    report = classification_report(y_val, y_pred, target_names=le.classes_, output_dict=True)
    print(classification_report(y_val, y_pred, target_names=le.classes_))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(
        {"clf": clf, "label_encoder": le, "hog_params": HOG_PARAMS, "tile_size": TILE},
        os.path.join(MODEL_DIR, "tile_classifier.joblib"),
    )
    with open(os.path.join(MODEL_DIR, "val_report.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nSaved model to {os.path.join(MODEL_DIR, 'tile_classifier.joblib')}")


if __name__ == "__main__":
    run()
