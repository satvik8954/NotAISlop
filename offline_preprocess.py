import cv2
import numpy as np
from pathlib import Path
import shutil
from scipy.ndimage import uniform_filter
import concurrent.futures

def lee_filter(img, size=3):
    """Mathematical Lee Filter for Sonar/SAR speckle reduction"""
    img_float = img.astype(np.float32)
    img_mean = uniform_filter(img_float, (size, size))
    img_sqr_mean = uniform_filter(img_float**2, (size, size))
    img_variance = img_sqr_mean - img_mean**2
    overall_variance = np.var(img_float)
    
    # Avoid division by zero
    img_weights = img_variance / (img_variance + overall_variance + 1e-5)
    filtered = img_mean + img_weights * (img_float - img_mean)
    return np.clip(filtered, 0, 255).astype(np.uint8)

def process_image(args):
    img_path, src, dst, split = args
    img = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
    if img is None: return False
    
    # 1. Lee Filter (Despeckle)
    filtered = lee_filter(img, size=3)
    # 2. CLAHE (Contrast Enhancement)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(filtered)
    
    # Save processed image
    out_path = dst / split / "images" / img_path.name
    cv2.imwrite(str(out_path), enhanced)
    return True

def preprocess_dataset(src_dir="dataset_final", dst_dir="dataset_yolov9"):
    # Ensure absolute paths
    src = Path("c:/Users/madhu/Downloads/sih/notaislop") / src_dir
    dst = Path("c:/Users/madhu/Downloads/sih/notaislop") / dst_dir
    
    if not src.exists():
        print(f"Error: Source directory {src} does not exist!")
        return
        
    if dst.exists(): 
        print("Cleaning up old preprocessing directory...")
        shutil.rmtree(dst)
    
    tasks = []
    
    for split in ["train", "val", "test"]:
        (dst / split / "images").mkdir(parents=True, exist_ok=True)
        (dst / split / "labels").mkdir(parents=True, exist_ok=True)
        
        # Copy labels directly
        for label in (src / split / "labels").glob("*.txt"):
            shutil.copy2(label, dst / split / "labels" / label.name)
            
        # Collect images
        for img_path in (src / split / "images").glob("*.*"):
            tasks.append((img_path, src, dst, split))
            
    print(f"Applying Lee Filter and CLAHE offline to {len(tasks)} images...")
    
    # Process in parallel for speed
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(process_image, tasks))
        
    # Copy configuration file
    shutil.copy2(src / "data.yaml", dst / "data.yaml")
    
    print(f"Successfully preprocessed {sum(results)} images.")
    print(f"Saved optimized dataset to: {dst}")

if __name__ == "__main__":
    preprocess_dataset()
