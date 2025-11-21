// server/controllers/edaController.js
const {
  getData,
  monthKey,
  yBucket,
  tally,
  sortTop,
  sampleArray,
} = require('../utils/dataStore');

/** Utilities **/
const notNull = (v) => v !== null && v !== undefined && v !== '';
const toNumber = (v) => (Number.isFinite(v) ? v : null);

// Values we want to ignore in ALL charts & filters
const EXCLUDED_CATEGORIES = new Set([
  'unknown',
  'unspecified',
  'does not apply',
  'does not apply/unknown',
  'not applicable',
  'na',
  'n/a',
]);

function normalizeCategoryValue(v) {
  if (v == null) return '';
  return String(v).trim();
}

function isExcludedCategoryValue(v) {
  const norm = normalizeCategoryValue(v).toLowerCase();
  if (!norm) return false;
  return EXCLUDED_CATEGORIES.has(norm);
}

function parseHourFromCrashTime(rawTime) {
  if (!rawTime) return null;

  const s = String(rawTime).trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;

  const hour = Number(m[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;

  return hour;
}

function deriveHourFromRecord(r) {
  const rawTime =
    r['CRASH TIME'] ||
    r['crash_time'] ||
    r['CRASH_TIME'] ||
    r['Crash Time'] ||
    r.time ||
    r['TIME'];

  return parseHourFromCrashTime(rawTime);
}

function deriveYearFromRecord(r) {
  const rawDate =
    r['CRASH DATE'] ||
    r['crash_date'] ||
    r['CRASH_DATE'] ||
    r['Crash Date'] ||
    r.date ||
    r['DATE'];

  if (!rawDate) return null;

  const s = String(rawDate).trim();
  // works for "10/26/2019" or "2019-10-26" etc: take last 4 digits
  const m = /(\d{4})\D*$/.exec(s);
  if (!m) return null;

  return m[1]; // keep as string (e.g. "2019")
}

/**
 * Parse filters from query:
 *   filters=[{"col":"borough","op":"in","val":["Queens","Brooklyn"]}, ...]
 */
const parseFilters = (raw) => {
  if (!raw) return [];
  try {
    if (Array.isArray(raw)) {
      const merged = [];
      for (const r of raw) {
        if (typeof r === 'string') merged.push(...JSON.parse(r));
        else if (Array.isArray(r)) merged.push(...r);
      }
      return merged;
    }
    if (typeof raw === 'string') {
      return JSON.parse(raw);
    }
    if (typeof raw === 'object') return raw;
  } catch (err) {
    console.warn('[filters] Failed to parse filters param:', err);
  }
  return [];
};

/**
 * Virtual columns used by the UI
 */
const getFieldValues = (record, col) => {
  if (!record) return [];

  if (col === 'vehicle_type') {
    return [
      record.vehicle_type_code1,
      record.vehicle_type_code2,
      record.vehicle_type_code_3,
      record.vehicle_type_code_4,
      record.vehicle_type_code_5,
    ].filter(notNull);
  }

  if (col === 'factor') {
    const values = [];
    if (notNull(record.contributing_factor_vehicle_1)) {
      values.push(record.contributing_factor_vehicle_1);
    }
    if (notNull(record.contributing_factor_vehicle_2)) {
      values.push(record.contributing_factor_vehicle_2);
    }
    return values;
  }

  // virtual year from CRASH DATE
  if (col === 'year') {
    const y = deriveYearFromRecord(record);
    return y ? [String(y)] : [];
  }

  // Default: direct column access
  return [record[col]];
};

/**
 * Global filter matcher with AND / OR logic
 * logic: 'AND' (default) or 'OR'
 */
function recordMatchesFilters(record, filters, logic = 'AND') {
  if (!filters || filters.length === 0) return true;

  const isAnd = String(logic).toUpperCase() !== 'OR';

  const matchesOneFilter = (f) => {
    if (!f || !f.col) return true; // ignore invalid filters

    const col = f.col;
    const op = (f.op || 'eq').toLowerCase();
    const val = f.val;

    // Normalize and exclude bad categories
    const rawValues = getFieldValues(record, col);
    const values = rawValues
      .map((v) => normalizeCategoryValue(v))
      .filter((v) => notNull(v) && !isExcludedCategoryValue(v));

    if (values.length === 0) return false;

    if (op === 'in') {
      const allowed = Array.isArray(val) ? val : [val];
      const allowedSet = new Set(
        allowed.map((v) => normalizeCategoryValue(v))
      );
      return values.some((v) => allowedSet.has(v));
    }

    if (op === 'contains') {
      const pattern = String(val ?? '');
      if (!pattern) return true; // effectively no-op filter
      let re;
      try {
        re = new RegExp(pattern, 'i');
      } catch (e) {
        const escaped = pattern.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
        re = new RegExp(escaped, 'i');
      }
      return values.some((v) => re.test(String(v)));
    }

    // default: eq
    const target = normalizeCategoryValue(val);
    return values.some((v) => v === target);
  };

  if (isAnd) {
    // record must satisfy ALL filters
    for (const f of filters) {
      if (!matchesOneFilter(f)) return false;
    }
    return true;
  } else {
    // record must satisfy AT LEAST ONE filter
    for (const f of filters) {
      if (matchesOneFilter(f)) return true;
    }
    return false;
  }
}

/** ---- DISTINCT VALUES (for filters dropdowns) ----
 * /api/eda/distinct?col=borough&from=crashes
 */
async function distinctValues(req, res) {
  const { crashes, persons } = getData();
  const col = req.query.col;
  const from = (req.query.from || 'crashes').toLowerCase();

  const src = from === 'persons' ? persons : crashes;
  const set = new Set();

  for (const r of src) {
    if (!r) continue;
    const raw = r[col];
    const v = normalizeCategoryValue(raw);
    if (!v || isExcludedCategoryValue(v)) continue;
    set.add(v);
  }

  const values = Array.from(set).sort((a, b) => a.localeCompare(b));
  res.json({ col, from, values });
}

/** ---- LINE (time series) ----
 * /api/eda/line?date_col=crash_date&freq=M|Y&logic=AND|OR
 */
async function lineByTime(req, res) {
  const { crashes } = getData();
  const dateCol = req.query.date_col || 'crash_date';
  const freq = (req.query.freq || 'M').toUpperCase(); // 'M' or 'Y'

  const filters = parseFilters(req.query.filters);
  const logic = (req.query.logic || req.query.mode || 'AND').toUpperCase();

  const bucketFn = freq === 'Y' ? yBucket : monthKey;
  const buckets = new Map();

  for (const c of crashes) {
    if (!recordMatchesFilters(c, filters, logic)) continue;
    const d = c[dateCol];
    if (!d) continue;
    const key = bucketFn(d);
    if (!key) continue;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const x = Array.from(buckets.keys()).sort();
  const y = x.map((k) => buckets.get(k) || 0);
  const points = x.map((xi, i) => ({ x: xi, y: y[i] }));

  res.json({ x, y, points });
}

/** ---- BAR (top categories) ----
 * /api/eda/bar?cat=borough|vehicle_type|factor|bodily_injury&top=12&logic=AND|OR
 */
async function barCounts(req, res) {
  const { crashes, persons } = getData();
  const cat = (req.query.cat || 'borough').toLowerCase();
  const top = parseInt(req.query.top || '12', 10);

  const filters = parseFilters(req.query.filters);
  const logic = (req.query.logic || req.query.mode || 'AND').toUpperCase();

  let counts;

  if (cat === 'vehicle_type') {
    const vt = [];
    for (const c of crashes) {
      if (!recordMatchesFilters(c, filters, logic)) continue;
      const types = [
        c.vehicle_type_code1,
        c.vehicle_type_code2,
        c.vehicle_type_code_3,
        c.vehicle_type_code_4,
        c.vehicle_type_code_5,
      ];
      for (const t of types) {
        const v = normalizeCategoryValue(t);
        if (!v || isExcludedCategoryValue(v)) continue;
        vt.push(v);
      }
    }
    counts = tally(vt);
  } else if (cat === 'factor') {
    const fac = [];
    for (const c of crashes) {
      if (!recordMatchesFilters(c, filters, logic)) continue;
      const v1 = normalizeCategoryValue(c.contributing_factor_vehicle_1);
      const v2 = normalizeCategoryValue(c.contributing_factor_vehicle_2);
      if (v1 && !isExcludedCategoryValue(v1)) fac.push(v1);
      if (v2 && !isExcludedCategoryValue(v2)) fac.push(v2);
    }
    counts = tally(fac);
  } else if (cat === 'bodily_injury') {
    const values = [];
    for (const p of persons) {
      if (!recordMatchesFilters(p, filters, logic)) continue;
      const v = normalizeCategoryValue(p.bodily_injury);
      if (!v || isExcludedCategoryValue(v)) continue;
      values.push(v);
    }
    counts = tally(values);
  } else {
    const values = [];
    for (const c of crashes) {
      if (!recordMatchesFilters(c, filters, logic)) continue;
      const v = normalizeCategoryValue(c[cat]);
      if (!v || isExcludedCategoryValue(v)) continue;
      values.push(v);
    }
    counts = tally(values);
  }

  const data = sortTop(counts, top);
  const x = data.map((d) => d.category);
  const y = data.map((d) => d.count);

  res.json({ x, y, data });
}

/** ---- PIE (reuses bar logic) ----
 * /api/eda/pie?cat=bodily_injury&top=8&logic=AND|OR
 */
async function pieCounts(req, res) {
  const _req = { query: req.query };
  const _res = { json(payload) { this.payload = payload; } };
  await barCounts(_req, _res);

  const { x, y, data } = _res.payload;
  res.json({ labels: x, values: y, data });
}

/** ---- SCATTER ----
 * /api/eda/scatter?x=latitude&y=hour&limit=3000&from=crashes|persons&logic=AND|OR
 */
async function scatterXY(req, res) {
  const { crashes, persons } = getData();
  const xKey  = req.query.x || 'latitude';
  const yKey  = req.query.y || 'hour';
  const limit = parseInt(req.query.limit || '3000', 10);
  const from  = (req.query.from || 'crashes').toLowerCase();

  const filters = parseFilters(req.query.filters);
  const logic = (req.query.logic || req.query.mode || 'AND').toUpperCase();

  const src = from === 'persons' ? persons : crashes;

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const inNYCLat = (v) => v >= 40 && v <= 41;
  const inNYCLon = (v) => v >= -75 && v <= -72;

  const pts = [];
  for (const r of src) {
    if (!recordMatchesFilters(r, filters, logic)) continue;
    let xv = num(r[xKey]);
    let yv = num(r[yKey]);
    if (xv === null || yv === null) continue;

    if (xKey === 'latitude'   && !inNYCLat(xv)) continue;
    if (xKey === 'longitude'  && !inNYCLon(xv)) continue;
    if (yKey === 'latitude'   && !inNYCLat(yv)) continue;
    if (yKey === 'longitude'  && !inNYCLon(yv)) continue;

    if ((xKey === 'latitude' || xKey === 'longitude') && xv === 0) continue;
    pts.push([xv, yv]);
  }

  const sampled = sampleArray(pts, limit);
  const x = sampled.map((p) => p[0]);
  const y = sampled.map((p) => p[1]);

  res.json({ x, y });
}

/** ---- BOX PLOT ----
 * /api/eda/box?col=hour&by=bodily_injury&from=persons|crashes&logic=AND|OR
 */
async function boxSummary(req, res) {
  const { crashes, persons } = getData();

  const col = req.query.col || 'hour';
  const by = req.query.cat || req.query.by || 'bodily_injury';
  const from = (req.query.from || 'persons').toLowerCase();

  const filters = parseFilters(req.query.filters);
  const logic = (req.query.logic || req.query.mode || 'AND').toUpperCase();

  const src = from === 'crashes' ? crashes : persons;
  const groups = new Map();
  const maxPerGroup = 3000;

  for (const r of src) {
    if (!r) continue;
    if (!recordMatchesFilters(r, filters, logic)) continue;

    let rawGroup = r[by];
    let g = normalizeCategoryValue(rawGroup);

    if (!g || isExcludedCategoryValue(g)) continue;

    let v;
    if (col === 'hour') {
      v = deriveHourFromRecord(r);
    } else {
      v = toNumber(Number(r[col]));
    }

    if (!notNull(v)) continue;

    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(v);
  }

  const series = Array.from(groups.entries())
    .map(([name, vals]) => ({ name, y: sampleArray(vals, maxPerGroup) }))
    .filter((s) => s.y.length > 0)
    .sort((a, b) => b.y.length - a.y.length);

  const describe = (arr) => {
    const a = [...arr].sort((p, q) => p - q);
    const n = a.length;
    const q = (p) => a[Math.floor((p / 100) * (n - 1))];
    return { n, min: a[0], q1: q(25), median: q(50), q3: q(75), max: a[n - 1] };
  };

  const stats = series.map((s) => ({ name: s.name, ...describe(s.y) }));

  res.json({ series, groups: stats });
}

/** ---- HISTOGRAM ----
 * /api/eda/hist?col=hour&bins=24&from=persons|crashes&logic=AND|OR
 */
async function histogram(req, res) {
  const { crashes, persons } = getData();

  const col = req.query.col || 'hour';
  const from = (req.query.from || 'crashes').toLowerCase();
  const bins = Number(req.query.bins) || 24;

  const filters = parseFilters(req.query.filters);
  const logic = (req.query.logic || req.query.mode || 'AND').toUpperCase();

  const src = from === 'persons' ? persons : crashes;
  const values = [];

  for (const r of src) {
    if (!r) continue;
    if (!recordMatchesFilters(r, filters, logic)) continue;

    let v;
    if (col === 'hour') {
      v = deriveHourFromRecord(r);
    } else {
      v = toNumber(Number(r[col]));
    }

    if (!notNull(v)) continue;
    values.push(v);
  }

  res.json({ values, bins });
}

/** ---- CORRELATION (heatmap) ----
 * /api/eda/corr?cols=latitude,hour,number_of_persons_injured&logic=AND|OR
 */
async function corrMatrix(req, res) {
  const { crashes } = getData();
  const cols = (req.query.cols || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const filters = parseFilters(req.query.filters);
  const logic = (req.query.logic || req.query.mode || 'AND').toUpperCase();

  if (cols.length < 2) return res.json({ z: [], x: cols, y: cols });

  const rows = [];
  for (const c of crashes) {
    if (!recordMatchesFilters(c, filters, logic)) continue;
    const row = cols.map((k) => toNumber(Number(c[k])));
    if (row.every(notNull)) rows.push(row);
  }
  if (rows.length === 0) return res.json({ z: [], x: cols, y: cols });

  const n = rows.length;
  const m = cols.length;
  const means = new Array(m).fill(0);
  for (const row of rows) for (let j = 0; j < m; j++) means[j] += row[j];
  for (let j = 0; j < m; j++) means[j] /= n;

  const std = new Array(m).fill(0);
  for (const row of rows) for (let j = 0; j < m; j++) std[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < m; j++) std[j] = Math.sqrt(std[j] / Math.max(1, n - 1));

  const z = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let a = 0; a < m; a++) {
    for (let b = a; b < m; b++) {
      if (a === b) { z[a][b] = 1; continue; }
      let cov = 0;
      for (const row of rows) cov += (row[a] - means[a]) * (row[b] - means[b]);
      cov /= Math.max(1, n - 1);
      const r = (std[a] === 0 || std[b] === 0) ? 0 : cov / (std[a] * std[b]);
      z[a][b] = r;
      z[b][a] = r;
    }
  }

  res.json({ z, x: cols, y: cols });
}

module.exports = {
  distinctValues,
  lineByTime,
  barCounts,
  pieCounts,
  scatterXY,
  boxSummary,
  histogram,
  corrMatrix,
};