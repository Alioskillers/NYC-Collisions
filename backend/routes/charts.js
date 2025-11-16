module.exports = {
  groupByTime,
  lineByTime,
  barCounts,
  pieCounts,
  scatterXY,
  boxSummary,
  corrMatrix,
};

const _ds = require('../utils/dataStore');

// ----- Helpers (fallbacks if not provided by dataStore) -----
const clean = (v) => (v ?? '').toString().trim();
const isFiniteNum = (n) => Number.isFinite(n);

// Month bucket from "MM/DD/YYYY"
const _ymFromMDY = (s) => {
  s = clean(s);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const yy = m[3], mm = String(+m[1]).padStart(2, '0');
  return `${yy}-${mm}`;
};
const _yFromMDY = (s) => {
  s = clean(s);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? m[3] : null;
};

const tally = _ds.tally || function tally(arr) {
  const m = new Map();
  for (const v of arr) {
    const k = (v ?? 'Unknown').toString().trim() || 'Unknown';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
};

const sortTop = _ds.sortTop || function sortTop(map, top = 12) {
  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
};

const sampleArray = _ds.sampleArray || function sampleArray(arr, n) {
  if (!Array.isArray(arr) || arr.length <= n) return arr || [];
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
};

const ymBucket = _ds.ymBucket || _ymFromMDY;
const yBucket  = _ds.yBucket  || _yFromMDY;

// Resolve data regardless of how utils/dataStore exports it
function getData() {
  if (typeof _ds.getData === 'function') return _ds.getData();

  const s = _ds.store || _ds || {};
  const crashes =
    Array.isArray(s.crashes) ? s.crashes :
    Array.isArray(_ds.crashes) ? _ds.crashes : [];
  const persons =
    Array.isArray(s.persons) ? s.persons :
    Array.isArray(_ds.persons) ? _ds.persons : [];

  const byCollision =
    (s.crashById instanceof Map) ? s.crashById :
    (s.byCollision instanceof Map) ? s.byCollision :
    (_ds.byCollision instanceof Map) ? _ds.byCollision :
    new Map();

  const personsByCollision =
    (s.personsByCollision instanceof Map) ? s.personsByCollision :
    (_ds.personsByCollision instanceof Map) ? _ds.personsByCollision :
    new Map();

  return {
    crashes,
    persons,
    byCollision,
    personsByCollision,
    meta: { crashes: crashes.length, persons: persons.length },
  };
}

// ---------- Filter helpers ----------

function parseFilters(raw) {
  if (!raw) return [];

  try {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      return JSON.parse(trimmed);
    }
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object') return [raw];
  } catch (err) {
    console.warn('[charts] Failed to parse filters', err);
  }
  return [];
}

function getFieldValues(rec, col) {
  if (!rec) return [];

  switch (col) {
    case 'vehicle_type':
      // Expect array on crashes: vehicle_types
      return Array.isArray(rec.vehicle_types)
        ? rec.vehicle_types.filter(Boolean).map(clean)
        : [];
    case 'factor':
      // Expect array on crashes: factors
      return Array.isArray(rec.factors)
        ? rec.factors.filter(Boolean).map(clean)
        : [];
    default: {
      const v = rec[col];
      return v == null ? [] : [clean(v)];
    }
  }
}

function recordMatchesFilters(rec, filters) {
  if (!filters || filters.length === 0) return true;
  if (!rec) return false;

  for (const f of filters) {
    const col = f.col;
    const op = f.op || 'eq';
    const val = f.val;

    if (!col) continue; // ignore malformed

    const values = getFieldValues(rec, col);

    if (op === 'in') {
      const allowed = Array.isArray(val) ? val.map(clean) : [clean(val)];
      const set = new Set(allowed);
      const any = values.some((v) => set.has(v));
      if (!any) return false;
      continue;
    }

    if (op === 'contains') {
      const pattern = typeof val === 'string' ? val : '';
      if (!pattern) continue;
      let re = null;
      try {
        re = new RegExp(pattern);
      } catch {
        re = null;
      }
      if (!re) continue;
      const any = values.some((v) => re.test(v));
      if (!any) return false;
      continue;
    }

    // default: eq
    const target = clean(val);
    const any = values.some((v) => v === target);
    if (!any) return false;
  }

  return true;
}

// ---------- Controllers ----------

// Group by time
function groupByTime(crashes, date_col, freq) {
  const pickBucket = freq === 'Y' ? yBucket : ymBucket;
  const m = tally(crashes.map((r) => pickBucket(r[date_col])).filter(Boolean));
  return Array.from(m.entries())
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
}

async function lineByTime(req, res) {
  const { crashes } = getData();
  const date_col = req.query.date_col || 'crash_date';
  const freq = (req.query.freq || 'M').toUpperCase();
  const filters = parseFilters(req.query.filters);

  const rows = filters.length
    ? crashes.filter((c) => recordMatchesFilters(c, filters))
    : crashes;

  res.json(groupByTime(rows, date_col, freq));
}

function explodeAndTally(rows, pick, top) {
  const flat = [];
  for (const r of rows) {
    const arr = pick(r) || [];
    for (const v of arr) flat.push((v || 'Unknown').trim() || 'Unknown');
  }
  const m = tally(flat);
  return sortTop(m, top);
}

async function barCounts(req, res) {
  const { crashes, persons } = getData();
  const rawCat = req.query.cat || '';
  const cat = rawCat.toLowerCase();
  const top = Number(req.query.top || 12);
  const filters = parseFilters(req.query.filters);

  const applyFilters = (rows) =>
    filters.length ? rows.filter((r) => recordMatchesFilters(r, filters)) : rows;

  let out = [];
  switch (cat) {
    case 'borough': {
      const src = applyFilters(crashes);
      const m = tally(src.map((r) => r.borough || 'Unknown'));
      out = sortTop(m, top);
      break;
    }
    case 'vehicle_type': {
      const src = applyFilters(crashes);
      out = explodeAndTally(src, (r) => r.vehicle_types || [], top);
      break;
    }
    case 'factor': {
      const src = applyFilters(crashes);
      out = explodeAndTally(src, (r) => r.factors || [], top);
      break;
    }
    case 'bodily_injury': {
      const src = applyFilters(persons);
      const m = tally(src.map((p) => p.bodily_injury || 'Unknown'));
      out = sortTop(m, top);
      break;
    }
    default: {
      const src = applyFilters(crashes);
      const m = tally(src.map((r) => r[rawCat] ?? 'Unknown'));
      out = sortTop(m, top);
    }
  }
  res.json(out);
}

async function pieCounts(req, res) {
  return barCounts(req, res);
}

async function scatterXY(req, res) {
  const { crashes } = getData();
  const xKey = (req.query.x || 'latitude').toLowerCase();
  const yKey = (req.query.y || 'hour').toLowerCase();
  const limit = Number(req.query.limit || 3000);
  const filters = parseFilters(req.query.filters);

  const toNum = (c, k) => {
    if (k === 'hour') return c.hour ?? null;
    if (k === 'latitude') return c.latitude;
    if (k === 'longitude') return c.longitude;
    const n = Number(c[k]);
    return Number.isFinite(n) ? n : null;
  };

  const pts = [];
  for (const c of crashes) {
    if (!recordMatchesFilters(c, filters)) continue;
    const xv = toNum(c, xKey);
    const yv = toNum(c, yKey);
    if (isFiniteNum(xv) && isFiniteNum(yv)) pts.push({ x: xv, y: yv });
  }
  res.json(sampleArray(pts, limit));
}

async function boxSummary(req, res) {
  const { crashes, persons, byCollision } = getData();
  const col = (req.query.col || 'hour').toLowerCase();
  const by = (req.query.by || '').toLowerCase();
  const filters = parseFilters(req.query.filters);

  const series = new Map(); // label -> number[]

  const pickFromCrash = (c) => {
    if (!c) return null;
    if (col === 'hour') return c.hour ?? null;
    if (col === 'latitude') return c.latitude ?? null;
    if (col === 'longitude') return c.longitude ?? null;
    const n = Number(c[col]);
    return Number.isFinite(n) ? n : null;
  };

  if (by === 'bodily_injury') {
    for (const p of persons) {
      if (!recordMatchesFilters(p, filters)) continue;
      const c = byCollision.get(p.collision_id);
      const v = pickFromCrash(c);
      if (!isFiniteNum(v)) continue;
      const label = p.bodily_injury || 'Unknown';
      if (!series.has(label)) series.set(label, []);
      series.get(label).push(v);
    }
  } else {
    for (const c of crashes) {
      if (!recordMatchesFilters(c, filters)) continue;
      const v = pickFromCrash(c);
      if (!isFiniteNum(v)) continue;
      if (!series.has(col)) series.set(col, []);
      series.get(col).push(v);
    }
  }

  res.json(
    Array.from(series.entries()).map(([label, values]) => ({ label, values }))
  );
}

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i],
      y = ys[i];
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return 0;
  return cov / Math.sqrt(vx * vy);
}

async function corrMatrix(req, res) {
  const { crashes } = getData();
  const cols = (req.query.cols || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (cols.length < 2) return res.json([]);

  const filters = parseFilters(req.query.filters);

  const getNum = (c, k) => {
    if (k === 'hour') return c.hour ?? null;
    if (k === 'latitude') return c.latitude ?? null;
    if (k === 'longitude') return c.longitude ?? null;
    const n = Number(c[k]);
    return Number.isFinite(n) ? n : null;
  };

  const out = [];
  for (let i = 0; i < cols.length - 1; i++) {
    for (let j = i + 1; j < cols.length; j++) {
      const a = cols[i],
        b = cols[j];
      const xs = [],
        ys = [];
      for (const c of crashes) {
        if (!recordMatchesFilters(c, filters)) continue;
        const xv = getNum(c, a);
        const yv = getNum(c, b);
        if (isFiniteNum(xv) && isFiniteNum(yv)) {
          xs.push(xv);
          ys.push(yv);
        }
      }
      const cap = Math.min(
        xs.length,
        Number(process.env.CORR_SAMPLE_MAX || 20000)
      );
      out.push({ a, b, r: pearson(xs.slice(0, cap), ys.slice(0, cap)) });
    }
  }
  res.json(out);
}

module.exports = {
  groupByTime,
  lineByTime,
  barCounts,
  pieCounts,
  scatterXY,
  boxSummary,
  corrMatrix,
};