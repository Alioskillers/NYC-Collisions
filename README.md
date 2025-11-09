# Collisions (NYC Motor Vehicle Collisions)

Data engineering + visualization project (GIU, W25).

## Stack
- Backend API: **Flask** on **Vercel Functions**
- Frontend: **React + Plotly.js** (to be added next)
- Data: NYC Open Data (Crashes + Persons) joined by `COLLISION_ID`.

## Quick start (local)
```bash
# From Collisions/
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 1) Download raw CSVs
python3 scripts/download_data.py

# 2) Clean + integrate + write Parquet
python3 scripts/clean_integrate.py

# 3) Run API locally
export FLASK_APP=api/index.py && flask run -p 8000
# Now at: http://127.0.0.1:8000/api/health# NYC-Collisions
