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
  'unsspecified',
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

/**
 * CRASH_DATE / CRASH_TIME helpers
 */

// Get CRASH_DATE from record in whatever key exists
function getRawCrashDate(record) {
  return (
    record['CRASH_DATE'] ||
    record['crash_date'] ||
    record['CRASH DATE'] ||
    record['Crash Date'] ||
    record.date ||
    record['DATE']
  );
}

// Get CRASH TIME field if the dataset ever has it
function getRawCrashTime(record) {
  return (
    record['CRASH TIME'] ||
    record['crash_time'] ||
    record['CRASH_TIME'] ||
    record['Crash Time'] ||
    record.time ||
    record['TIME']
  );
}

// Parse hour from a time string like "13:45", "07:00", "9:30", "02:00:00"
function parseHourFromTimeString(rawTime) {
  if (!rawTime) return null;
  const s = String(rawTime).trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(s);
  if (!m) return null;

  const hour = Number(m[1]);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

// Derive HOUR from record.
// 1) Prefer CRASH TIME if present.
// 2) Else, try to read hour from CRASH_DATE if it contains a time portion.
let deriveHourDebugCount = 0;
function deriveHourFromRecord(r) {
  const rawTime = getRawCrashTime(r);

  // --- CASE 1: explicit CRASH TIME column ---
  if (rawTime) {
    const h = parseHourFromTimeString(rawTime);
    if (deriveHourDebugCount < 10) {
      console.log(
        '[deriveHourFromRecord] from CRASH_TIME =',
        rawTime,
        '-> hour =',
        h
      );
      deriveHourDebugCount++;
    }
    if (h !== null) return h;
  }

  // --- CASE 2: derive from CRASH_DATE if it has time ---
  const rawDate = getRawCrashDate(r);
  if (!rawDate) {
    if (deriveHourDebugCount < 10) {
      console.log('[deriveHourFromRecord] No CRASH_DATE or CRASH_TIME in record');
      deriveHourDebugCount++;
    }
    return null;
  }

  // If it's already a Date object
  if (rawDate instanceof Date && !isNaN(rawDate)) {
    const h = rawDate.getHours();
    if (deriveHourDebugCount < 10) {
      console.log(
        '[deriveHourFromRecord] Date object',
        rawDate.toString(),
        '-> hour =',
        h
      );
      deriveHourDebugCount++;
    }
    return Number.isFinite(h) ? h : null;
  }

  const s = String(rawDate).trim();

  // ISO format: 2019-10-26T14:32:00.000Z
  const isoMatch = /T(\d{2}):(\d{2})/.exec(s);
  if (isoMatch) {
    const h = Number(isoMatch[1]);
    if (deriveHourDebugCount < 10) {
      console.log(
        '[deriveHourFromRecord] ISO date string',
        s,
        '-> hour =',
        h
      );
      deriveHourDebugCount++;
    }
    if (h >= 0 && h <= 23) return h;
  }

  // JS Date string: "Sat Oct 26 2019 02:00:00 GMT+0200 (Eastern European Standard Time)"
  const dateStrMatch = /\s(\d{1,2}):(\d{2}):(\d{2})\s/.exec(s);
  if (dateStrMatch) {
    const h = Number(dateStrMatch[1]);
    if (deriveHourDebugCount < 10) {
      console.log(
        '[deriveHourFromRecord] Date.toString() string',
        s,
        '-> hour =',
        h
      );
      deriveHourDebugCount++;
    }
    if (h >= 0 && h <= 23) return h;
  }

  // "10/26/2019 13:45"
  const parts = s.split(/\s+/);
  if (parts.length >= 2) {
    const h2 = parseHourFromTimeString(parts[1]);
    if (deriveHourDebugCount < 10) {
      console.log(
        '[deriveHourFromRecord] split on space: date=',
        parts[0],
        'time=',
        parts[1],
        '-> hour =',
        h2
      );
      deriveHourDebugCount++;
    }
    if (h2 !== null) return h2;
  }

  if (deriveHourDebugCount < 10) {
    console.log('[deriveHourFromRecord] FAILED to parse hour from', rawDate);
    deriveHourDebugCount++;
  }
  return null;
}

// Derive YEAR from CRASH_DATE
// Derive YEAR from CRASH_DATE
let deriveYearDebugCount = 0;
function deriveYearFromRecord(r) {
  const rawDate = getRawCrashDate(r);
  if (!rawDate) return null;

  // If it's already a Date object, just read the year
  if (rawDate instanceof Date && !isNaN(rawDate)) {
    const yy = rawDate.getFullYear();
    return String(yy);
  }

  const s = String(rawDate).trim();

  // Generic: take the FIRST 4-digit year that looks like 19xx or 20xx,
  // not the last 4 digits (to avoid picking "0200" from "GMT+0200").
  const m = /(19|20)\d{2}/.exec(s);
  if (m) {
    const year = m[0];
    if (deriveYearDebugCount < 10) {
      console.log('[deriveYearFromRecord] parsed year', year, 'from', s);
      deriveYearDebugCount++;
    }
    return year;
  }

  if (deriveYearDebugCount < 10) {
    console.log('[deriveYearFromRecord] could NOT parse year from:', rawDate);
    deriveYearDebugCount++;
  }
  return null;
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

  // virtual year from CRASH_DATE
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
let recordFilterDebugCount = 0;
function recordMatchesFilters(record, filters, logic = 'AND') {
  if (!filters || filters.length === 0) return true;

  const isAnd = String(logic).toUpperCase() !== 'OR';

  const matchesOneFilter = (f) => {
    if (!f || !f.col) return true; // ignore invalid filters

    const col = f.col;
    const op = (f.op || 'eq').toLowerCase();
    const val = f.val;

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
      const match = values.some((v) => allowedSet.has(v));

      if (recordFilterDebugCount < 20 && col === 'year') {
        console.log(
          '[recordMatchesFilters][year] values=',
          values,
          'allowed=',
          [...allowedSet],
          'match=',
          match
        );
      }

      return match;
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

  const result = isAnd
    ? filters.every((f) => matchesOneFilter(f))
    : filters.some((f) => matchesOneFilter(f));

  if (recordFilterDebugCount < 20 && filters.length > 0) {
    console.log(
      '[recordMatchesFilters] logic=',
      logic,
      '| filters=',
      JSON.stringify(filters),
      '| sample crash_date=',
      getRawCrashDate(record),
      '| result=',
      result
    );
    recordFilterDebugCount++;
  }

  return result;
}

/** ---- DISTINCT VALUES (for filters dropdowns) ----
 * /api/eda/distinct?col=borough&from=crashes
 */
async function distinctValues(req, res) {
  const { crashes, persons } = getData();
  const col = req.query.col;
  const from = (req.query.from || 'crashes').toLowerCase();

  console.log('[distinctValues] col=', col, 'from=', from);

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
  console.log(
    '[distinctValues] total distinct values for',
    col,
    ':',
    values.length
  );
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

  console.log(
    '[lineByTime] date_col=',
    dateCol,
    'freq=',
    freq,
    'logic=',
    logic,
    'filters=',
    filters
  );

  const bucketFn = freq === 'Y' ? yBucket : monthKey;
  const buckets = new Map();

  let processed = 0;
  let kept = 0;

  for (const c of crashes) {
    processed++;
    if (!recordMatchesFilters(c, filters, logic)) continue;
    const d = c[dateCol] || getRawCrashDate(c);
    if (!d) continue;
    const key = bucketFn(d);
    if (!key) continue;
    kept++;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  console.log(
    '[lineByTime] processed=',
    processed,
    'kept=',
    kept,
    'buckets=',
    buckets.size
  );

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

  console.log('[barCounts] cat=', cat, 'top=', top, 'logic=', logic, 'filters=', filters);

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

  console.log('[barCounts] data length=', data.length);

  res.json({ x, y, data });
}

/** ---- PIE (reuses bar logic) ----
 * /api/eda/pie?cat=bodily_injury&top=8&logic=AND|OR
 */
async function pieCounts(req, res) {
  console.log('[pieCounts] query=', req.query);
  const _req = { query: req.query };
  const _res = { json(payload) { this.payload = payload; } };
  await barCounts(_req, _res);

  const { x, y, data } = _res.payload || { x: [], y: [], data: [] };
  console.log('[pieCounts] labels=', x.length, 'values=', y.length);
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

  console.log('[scatterXY] x=', xKey, 'y=', yKey, 'from=', from, 'limit=', limit, 'logic=', logic, 'filters=', filters);

  const src = from === 'persons' ? persons : crashes;

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const inNYCLat = (v) => v >= 40 && v <= 41;
  const inNYCLon = (v) => v >= -75 && v <= -72;

  const pts = [];
  let processed = 0;
  let kept = 0;

  for (const r of src) {
    processed++;
    if (!recordMatchesFilters(r, filters, logic)) continue;

    let xv;
    if (xKey === 'hour') {
      xv = deriveHourFromRecord(r);
    } else if (xKey === 'year') {
      const y = deriveYearFromRecord(r);
      xv = y ? Number(y) : null;
    } else {
      xv = num(r[xKey]);
    }

    let yv;
    if (yKey === 'hour') {
      yv = deriveHourFromRecord(r);
    } else if (yKey === 'year') {
      const y = deriveYearFromRecord(r);
      yv = y ? Number(y) : null;
    } else {
      yv = num(r[yKey]);
    }

    if (xv === null || yv === null) continue;

    if (xKey === 'latitude'   && !inNYCLat(xv)) continue;
    if (xKey === 'longitude'  && !inNYCLon(xv)) continue;
    if (yKey === 'latitude'   && !inNYCLat(yv)) continue;
    if (yKey === 'longitude'  && !inNYCLon(yv)) continue;

    if ((xKey === 'latitude' || xKey === 'longitude') && xv === 0) continue;

    kept++;
    pts.push([xv, yv]);
  }

  console.log('[scatterXY] processed=', processed, 'kept=', kept, 'pts before sample=', pts.length);

  const sampled = sampleArray(pts, limit);
  const x = sampled.map((p) => p[0]);
  const y = sampled.map((p) => p[1]);

  console.log('[scatterXY] returning points=', x.length);

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

  console.log('[boxSummary] col=', col, 'by=', by, 'from=', from, 'logic=', logic, 'filters=', filters);

  const src = from === 'crashes' ? crashes : persons;
  const groups = new Map();
  const maxPerGroup = 3000;

  let processed = 0;
  let kept = 0;

  for (const r of src) {
    processed++;
    if (!r) continue;
    if (!recordMatchesFilters(r, filters, logic)) continue;

    let rawGroup = r[by];
    let g = normalizeCategoryValue(rawGroup);

    if (!g || isExcludedCategoryValue(g)) continue;

    let v;
    if (col === 'hour') {
      v = deriveHourFromRecord(r);
    } else if (col === 'year') {
      const yy = deriveYearFromRecord(r);
      v = yy ? Number(yy) : null;
    } else {
      v = toNumber(Number(r[col]));
    }

    if (!notNull(v)) continue;

    kept++;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(v);
  }

  console.log('[boxSummary] processed=', processed, 'kept numeric=', kept, 'groups=', groups.size);

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

  console.log('[boxSummary] series count=', series.length);

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

  console.log('[histogram] col=', col, 'from=', from, 'bins=', bins, 'logic=', logic, 'filters=', filters);

  const src = from === 'persons' ? persons : crashes;
  const values = [];

  let processed = 0;
  let kept = 0;

  for (const r of src) {
    processed++;
    if (!r) continue;
    if (!recordMatchesFilters(r, filters, logic)) continue;

    let v;
    if (col === 'hour') {
      v = deriveHourFromRecord(r);
    } else if (col === 'year') {
      const yy = deriveYearFromRecord(r);
      v = yy ? Number(yy) : null;
    } else {
      v = toNumber(Number(r[col]));
    }

    if (!notNull(v)) continue;
    kept++;
    values.push(v);
  }

  console.log(
    '[histogram] processed=',
    processed,
    'kept numeric=',
    kept,
    'values length=',
    values.length
  );

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

  console.log('[corrMatrix] cols=', cols, 'logic=', logic, 'filters=', filters);

  if (cols.length < 2) return res.json({ z: [], x: cols, y: cols });

  const rows = [];
  let processed = 0;
  let kept = 0;

  for (const c of crashes) {
    processed++;
    if (!recordMatchesFilters(c, filters, logic)) continue;

    const row = cols.map((k) => {
      if (k === 'hour') {
        const h = deriveHourFromRecord(c);
        return h == null ? null : Number(h);
      }
      if (k === 'year') {
        const yy = deriveYearFromRecord(c);
        return yy == null ? null : Number(yy);
      }
      return toNumber(Number(c[k]));
    });

    if (row.every(notNull)) {
      kept++;
      rows.push(row);
    }
  }

  console.log('[corrMatrix] processed=', processed, 'kept rows=', kept);

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

  console.log('[corrMatrix] finished corr matrix, size=', m, 'x', m);

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