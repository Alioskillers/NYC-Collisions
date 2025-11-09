# scripts/clean_integrate.py
import os
import pandas as pd
import numpy as np
from dateutil import parser

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data", "raw")
PROC = os.path.join(ROOT, "data", "processed")
os.makedirs(PROC, exist_ok=True)

CRASHES_CSV = os.path.join(RAW, "crashes.csv")
PERSONS_CSV = os.path.join(RAW, "persons.csv")

CRASHES_OUT = os.path.join(PROC, "crashes_clean.parquet")
PERSONS_OUT = os.path.join(PROC, "persons_clean.parquet")
INTEGRATED_OUT = os.path.join(PROC, "integrated.parquet")

def _to_datetime(date_col, time_col):
    # Robust parser for separate date/time columns
    def parse_row(row):
        d, t = row[date_col], row[time_col]
        if pd.isna(d):
            return pd.NaT
        try:
            if pd.isna(t):
                return parser.parse(str(d), dayfirst=False, yearfirst=False, fuzzy=True)
            return parser.parse(f"{d} {t}", dayfirst=False, yearfirst=False, fuzzy=True)
        except Exception:
            return pd.NaT
    return parse_row

def clean_crashes(df: pd.DataFrame) -> pd.DataFrame:
    # Standardize column names (lower, underscores)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Expect these to exist in NYC data
    # crash_date, crash_time, borough, zip_code, latitude, longitude, collision_id, number_of_persons_injured,...
    if "collision_id" not in df.columns:
        raise ValueError("Expected 'collision_id' in crashes")

    # Parse datetime
    if "crash_date" in df.columns and "crash_time" in df.columns:
        df["crash_datetime"] = df.apply(_to_datetime("crash_date", "crash_time"), axis=1)
        df["year"] = df["crash_datetime"].dt.year
        df["month"] = df["crash_datetime"].dt.month
        df["day"] = df["crash_datetime"].dt.day
        df["hour"] = df["crash_datetime"].dt.hour
    else:
        df["crash_datetime"] = pd.NaT

    # Clean borough text
    if "borough" in df.columns:
        df["borough"] = df["borough"].astype("string").str.strip().str.upper()

    # Clamp injury/fatality counts to >= 0
    for col in [c for c in df.columns if "injured" in c or "killed" in c]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        df[col] = df[col].clip(lower=0)

    # Drop exact duplicates by collision_id, keep the latest row with non-null datetime
    df.sort_values(["collision_id", "crash_datetime"], ascending=[True, False], inplace=True)
    df = df.drop_duplicates(subset=["collision_id"], keep="first")

    # Standard numeric types for lat/lon
    for col in ["latitude", "longitude"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Optional row filtering: keep rows with at least date or location or borough
    mask_valid = (
        df["crash_datetime"].notna()
        | df.get("borough", pd.Series(False, index=df.index)).notna()
        | (df.get("latitude", pd.Series(np.nan)).notna() & df.get("longitude", pd.Series(np.nan)).notna())
    )
    df = df.loc[mask_valid].reset_index(drop=True)

    return df

def clean_persons(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    if "collision_id" not in df.columns:
        raise ValueError("Expected 'collision_id' in persons")

    # Common useful columns (if present)
    # person_type, person_age, person_injury, contributing_factor_1, ejection, safety_equipment, vehicle_type_code1 ...
    # Standardize text columns
    text_cols = [c for c in ["person_type", "person_injury", "ejection", "safety_equipment", "contributing_factor_1"] if c in df.columns]
    for c in text_cols:
        df[c] = df[c].astype("string").str.strip().str.upper()

    # Age to numeric, clamp to [0, 110]
    if "person_age" in df.columns:
        df["person_age"] = pd.to_numeric(df["person_age"], errors="coerce").clip(lower=0, upper=110)

    # Deduplicate noisy rows
    subset = ["collision_id"] + [c for c in ["person_type", "person_injury", "person_age"] if c in df.columns]
    df = df.drop_duplicates(subset=subset).reset_index(drop=True)

    return df

def integrate(crashes: pd.DataFrame, persons: pd.DataFrame) -> pd.DataFrame:
    # Left join: keep all crashes, add persons info for drill-down/aggregation
    # We won't explode the dataset; instead, keep persons as one-to-many and allow API to aggregate on the fly.
    merged = crashes.merge(persons, on="collision_id", how="left", suffixes=("", "_person"))

    # Post-integration fixes
    # Any new NaNs from join remain; types are already coerced. Remove obvious blank strings.
    for c in merged.select_dtypes("string").columns:
        merged[c] = merged[c].replace({"": pd.NA})

    return merged

def main():
    print("Loading raw CSVs ...")
    df_crashes = pd.read_csv(CRASHES_CSV, low_memory=False)
    df_persons = pd.read_csv(PERSONS_CSV, low_memory=False)

    print("Cleaning crashes ...")
    df_crashes = clean_crashes(df_crashes)
    print(f"Crashes after clean: {len(df_crashes):,}")

    print("Cleaning persons ...")
    df_persons = clean_persons(df_persons)
    print(f"Persons after clean: {len(df_persons):,}")

    print("Integrating on COLLISION_ID ...")
    df_merged = integrate(df_crashes, df_persons)
    print(f"Integrated rows: {len(df_merged):,}")

    print("Saving Parquet ...")
    df_crashes.to_parquet(CRASHES_OUT, index=False)
    df_persons.to_parquet(PERSONS_OUT, index=False)
    df_merged.to_parquet(INTEGRATED_OUT, index=False)
    print("Done.")

if __name__ == "__main__":
    main()