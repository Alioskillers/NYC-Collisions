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

/** ---- LINE (time series) ----
 * /api/eda/line?date_col=crash_date&freq=M|Y
 * returns:
 *   { x:[bucket], y:[count], points:[{x,y}] }
 */
async function lineByTime(req, res) {
  const { crashes } = getData();
  const dateCol = req.query.date_col || 'crash_date';
  const freq = (req.query.freq || 'M').toUpperCase(); // 'M' or 'Y'

  const bucketFn = freq === 'Y' ? yBucket : monthKey;
  const buckets = new Map();

  for (const c of crashes) {
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
 * /api/eda/bar?cat=borough|vehicle_type|factor|bodily_injury&top=12
 * returns:
 *   { x:[category], y:[count], data:[{category,count}] }
 */
async function barCounts(req, res) {
  const { crashes, persons } = getData();
  const cat = (req.query.cat || 'borough').toLowerCase();
  const top = parseInt(req.query.top || '12', 10);

  let counts;

  if (cat === 'vehicle_type') {
    const vt = [];
    for (const c of crashes) {
      const v = [
        c.vehicle_type_code1,
        c.vehicle_type_code2,
        c.vehicle_type_code_3,
        c.vehicle_type_code_4,
        c.vehicle_type_code_5,
      ].filter(notNull);
      vt.push(...v);
    }
    counts = tally(vt);
  } else if (cat === 'factor') {
    const fac = [];
    for (const c of crashes) {
      if (notNull(c.contributing_factor_vehicle_1)) fac.push(c.contributing_factor_vehicle_1);
      if (notNull(c.contributing_factor_vehicle_2)) fac.push(c.contributing_factor_vehicle_2);
    }
    counts = tally(fac);
  } else if (cat === 'bodily_injury') {
    counts = tally(persons.map((p) => p.bodily_injury));
  } else {
    counts = tally(crashes.map((c) => c[cat]));
  }

  const data = sortTop(counts, top);
  const x = data.map((d) => d.category);
  const y = data.map((d) => d.count);

  res.json({ x, y, data });
}

/** ---- PIE (reuses bar logic) ----
 * /api/eda/pie?cat=bodily_injury&top=8
 * returns:
 *   { labels:[...], values:[...], data:[{category,count}] }
 */
async function pieCounts(req, res) {
  // reuse barCounts logic internally
  const _req = { query: req.query };
  const _res = { json(payload) { this.payload = payload; } };
  await barCounts(_req, _res);

  const { x, y, data } = _res.payload;
  res.json({ labels: x, values: y, data });
}

/** ---- SCATTER ----
 * /api/eda/scatter?x=latitude&y=hour&limit=3000&from=crashes|persons
 * returns: { x:[...], y:[...] }
 */
async function scatterXY(req, res) {
  const { crashes, persons } = getData();
  const xKey  = req.query.x || 'latitude';
  const yKey  = req.query.y || 'hour';
  const limit = parseInt(req.query.limit || '3000', 10);
  const from  = (req.query.from || 'crashes').toLowerCase();

  const src = from === 'persons' ? persons : crashes;

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const inNYCLat = (v) => v >= 40 && v <= 41;
  const inNYCLon = (v) => v >= -75 && v <= -72;

  const pts = [];
  for (const r of src) {
    let xv = num(r[xKey]);
    let yv = num(r[yKey]);
    if (xv === null || yv === null) continue;

    if (xKey === 'latitude'   && !inNYCLat(xv)) continue;
    if (xKey === 'longitude'  && !inNYCLon(xv)) continue;
    if (yKey === 'latitude'   && !inNYCLat(yv)) continue;
    if (yKey === 'longitude'  && !inNYCLon(yv)) continue;

    // treat latitude/longitude == 0 as missing
    if ((xKey === 'latitude' || xKey === 'longitude') && xv === 0) continue;
    pts.push([xv, yv]);
  }

  const sampled = sampleArray(pts, limit);
  const x = sampled.map((p) => p[0]);
  const y = sampled.map((p) => p[1]);

  res.json({ x, y });
}

/** ---- BOX PLOT ----
 * /api/eda/box?col=hour&by=bodily_injury&from=persons|crashes
 * returns:
 *   { series: [ { name, y:[values] }, ... ],
 *     groups: [{name, n, min, q1, median, q3, max}] }   // extra stats (optional for UI)
 */
async function boxSummary(req, res) {
  const { crashes, persons } = getData();
  const col = req.query.col || 'hour';
  const by = req.query.by || 'bodily_injury';
  const from = (req.query.from || 'persons').toLowerCase();

  const src = from === 'crashes' ? crashes : persons;
  const groups = new Map();

  for (const r of src) {
    const g = (r[by] ?? 'Unknown').toString().trim() || 'Unknown';
    const v = toNumber(Number(r[col]));
    if (!notNull(v)) continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(v);
  }

  const maxPerGroup = 3000;
  const series = Array.from(groups.entries())
    .map(([name, vals]) => ({ name, y: sampleArray(vals, maxPerGroup) }))
    .filter((s) => s.y.length > 0)
    .sort((a, b) => b.y.length - a.y.length);

  // optional descriptive stats if a component expects them
  const describe = (arr) => {
    const a = [...arr].sort((p, q) => p - q);
    const n = a.length;
    const q = (p) => a[Math.floor((p/100) * (n - 1))];
    return { n, min: a[0], q1: q(25), median: q(50), q3: q(75), max: a[n-1] };
    };
  const stats = series.map(s => ({ name: s.name, ...describe(s.y) }));

  res.json({ series, groups: stats });
}

/** ---- HISTOGRAM ----
 * /api/eda/hist?col=hour&bins=24&from=persons|crashes
 * returns:
 *   { values, bins }
 */
async function histogram(req, res) {
  const { crashes, persons } = getData();
  const col   = req.query.col || 'hour';
  const bins  = Math.max(1, parseInt(req.query.bins || '24', 10));
  const from  = (req.query.from || 'persons').toLowerCase();

  const src = from === 'crashes' ? crashes : persons;
  const values = [];
  for (const r of src) {
    const v = Number(r[col]);
    if (Number.isFinite(v)) values.push(v);
  }

  res.json({ values, bins });
}

/** ---- CORRELATION (heatmap) ----
 * /api/eda/corr?cols=latitude,hour,number_of_persons_injured
 * returns: { z:[[...]], x:[colnames], y:[colnames] }
 */
async function corrMatrix(req, res) {
  const { crashes } = getData();
  const cols = (req.query.cols || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (cols.length < 2) return res.json({ z: [], x: cols, y: cols });

  const rows = [];
  for (const c of crashes) {
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
  lineByTime,
  barCounts,
  pieCounts,
  scatterXY,
  boxSummary,
  histogram,
  corrMatrix,
};