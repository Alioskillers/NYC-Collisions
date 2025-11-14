// server/utils/filters.js

/**
 * Filter utility supports:
 *  - Virtual columns:
 *      year         → extracted from crash_date (Date or "dd/mm/yyyy" string)
 *      vehicle_type → array merged from vehicle_type_code1..5
 *      factor       → array merged from contributing_factor_vehicle_1..2
 *  - Ops: eq, in, contains, gte, lte
 *  - Case-insensitive matching for strings
 *  - logic: combine predicates with AND (default) or OR
 */

function parseFilters(req) {
  try {
    const raw = req.query.filters;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function parseYearFromValue(val) {
  if (!val) return null;
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.getUTCFullYear();
  }
  if (typeof val === 'string') {
    const s = val.trim();
    const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // dd/mm/yyyy or d/m/yyyy
    if (m) return Number(m[3]);
    const iso = s.match(/^(\d{4})[/-]\d{1,2}[/-]\d{1,2}$/);    // yyyy-mm-dd
    if (iso) return Number(iso[1]);
  }
  return null;
}

function nonNullLower(x) {
  return x == null ? null : String(x).trim().toLowerCase();
}

function getColumnValue(row, col) {
  switch (String(col).toLowerCase()) {
    case 'year': {
      const y = parseYearFromValue(row.crash_date ?? row['CRASH DATE'] ?? row['CRASH_DATE']);
      return y;
    }
    case 'vehicle_type': {
      const vals = [
        row.vehicle_type_code1,
        row.vehicle_type_code2,
        row.vehicle_type_code_3,
        row.vehicle_type_code_4,
        row.vehicle_type_code_5,
      ].filter((v) => v != null && String(v).trim() !== '')
       .map((v) => String(v).trim());
      return vals; // array
    }
    case 'factor': {
      const vals = [
        row.contributing_factor_vehicle_1,
        row.contributing_factor_vehicle_2,
      ].filter((v) => v != null && String(v).trim() !== '')
       .map((v) => String(v).trim());
      return vals; // array
    }
    default:
      return row[col];
  }
}

function valueIncludesArray(vArr, needle, { useContains = false } = {}) {
  if (!Array.isArray(vArr) || vArr.length === 0) return false;
  if (needle == null) return false;

  if (Array.isArray(needle)) {
    const want = new Set(needle.map((x) => nonNullLower(x)));
    for (const v of vArr) {
      const vs = nonNullLower(v);
      if (vs && want.has(vs)) return true;
    }
    return false;
  }

  const needleStr = String(needle).toLowerCase();
  for (const v of vArr) {
    const vs = String(v).toLowerCase();
    if (useContains) {
      if (vs.includes(needleStr)) return true;
      continue;
    }
    if (vs === needleStr) return true;
  }
  return false;
}

function makePredicate(f) {
  const col = f.col;
  const op = (f.op || 'eq').toLowerCase();
  const val = f.val;

  return (row) => {
    const v = getColumnValue(row, col);

    if (Array.isArray(v)) {
      if (op === 'eq') return valueIncludesArray(v, val);
      if (op === 'in') return valueIncludesArray(v, Array.isArray(val) ? val : [val]);
      if (op === 'contains') {
        try {
          const rx = new RegExp(val, 'i');
          return v.some((s) => rx.test(String(s)));
        } catch {
          return valueIncludesArray(v, val, { useContains: true });
        }
      }
      if (op === 'gte' || op === 'lte') return true; // not meaningful on arrays
      return true;
    }

    if (op === 'eq') {
      if (typeof v === 'string' || typeof val === 'string') {
        return nonNullLower(v) === nonNullLower(val);
      }
      return v === val;
    }

    if (op === 'in') {
      if (!Array.isArray(val)) return false;
      if (typeof v === 'string') {
        const set = new Set(val.map((x) => String(x).toLowerCase()));
        return set.has(v.toLowerCase());
      }
      return val.includes(v);
    }

    if (op === 'contains') {
      if (v == null) return false;
      const s = String(v);
      try {
        const rx = new RegExp(val, 'i');
        return rx.test(s);
      } catch {
        return s.toLowerCase().includes(String(val).toLowerCase());
      }
    }

    if (op === 'gte') return Number(v) >= Number(val);
    if (op === 'lte') return Number(v) <= Number(val);

    return true;
  };
}

/**
 * filterRows(rows, filters, logic)
 * logic: "AND" (default) or "OR"
 */
function filterRows(rows, filters, logic = 'AND') {
  if (!filters || !filters.length) return rows;
  const preds = filters.map(makePredicate);
  const useOr = String(logic).toUpperCase() === 'OR';
  if (useOr) {
    return rows.filter((r) => preds.some((p) => p(r)));
  }
  return rows.filter((r) => preds.every((p) => p(r)));
}

module.exports = { parseFilters, filterRows };