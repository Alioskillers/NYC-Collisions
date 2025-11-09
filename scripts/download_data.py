# scripts/download_data.py
import os
import requests
from tqdm import tqdm
import pandas as pd

CRASHES_URL = "https://data.cityofnewyork.us/api/views/h9gi-nx95/rows.csv?accessType=DOWNLOAD"
PERSONS_URL = "https://data.cityofnewyork.us/api/views/f55k-p6yu/rows.csv?accessType=DOWNLOAD"

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
os.makedirs(RAW_DIR, exist_ok=True)

def download_with_progress(url, save_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()

    total = int(response.headers.get("content-length", 0))
    chunk_size = 1024 * 1024  # 1 MB

    with open(save_path, "wb") as f, tqdm(
        total=total,
        unit="B",
        unit_scale=True,
        unit_divisor=1024,
        desc=f"Downloading {os.path.basename(save_path)}",
        colour="green"
    ) as bar:
        for chunk in response.iter_content(chunk_size=chunk_size):
            if chunk:
                f.write(chunk)
                bar.update(len(chunk))


def main():
    crashes_path = os.path.join(RAW_DIR, "crashes.csv")
    persons_path = os.path.join(RAW_DIR, "persons.csv")

    print("Starting downloads...\n")

    # ---- DOWNLOAD WITH PROGRESS BAR ----
    download_with_progress(CRASHES_URL, crashes_path)
    print("Converting crashes to CSV (pandas reading)...")
    df_crashes = pd.read_csv(crashes_path, low_memory=False)
    df_crashes.to_csv(crashes_path, index=False)
    print(f"Saved: {crashes_path} ({len(df_crashes):,} rows)\n")

    download_with_progress(PERSONS_URL, persons_path)
    print("Converting persons to CSV (pandas reading)...")
    df_persons = pd.read_csv(persons_path, low_memory=False)
    df_persons.to_csv(persons_path, index=False)
    print(f"Saved: {persons_path} ({len(df_persons):,} rows)")

if __name__ == "__main__":
    main()