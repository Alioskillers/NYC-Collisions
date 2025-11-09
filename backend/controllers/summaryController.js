const { computeBarCounts, computeGroupByTime } = require('./edaController');
const _ds = require('../utils/dataStore');

// Safe access to current in-memory data
function _getData() {
  if (typeof _ds.getData === 'function') return _ds.getData();
  const s = _ds.store || _ds || {};
  const crashes =
    Array.isArray(s.crashes) ? s.crashes :
    Array.isArray(_ds.crashes) ? _ds.crashes : [];
  const persons =
    Array.isArray(s.persons) ? s.persons :
    Array.isArray(_ds.persons) ? _ds.persons : [];
  return { crashes, persons };
}

// helper: sum a numeric field on crashes (field might be null/undefined/NaN)
function sumCrash(crashes, field) {
  let total = 0;
  for (const c of crashes) {
    const v = Number(c?.[field] ?? 0);
    if (Number.isFinite(v)) total += v;
  }
  return total;
}

// Convert an array of {category,count} into {labels, values}
function toSeriesFromCategoryCount(arr) {
  const labels = [];
  const values = [];
  for (const { category, count } of arr) {
    labels.push(category);
    values.push(count);
  }
  return { labels, values };
}

// Convert an array of {bucket,count} into {labels, values}
function toSeriesFromBuckets(arr) {
  const labels = [];
  const values = [];
  for (const { bucket, count } of arr) {
    labels.push(bucket);
    values.push(count);
  }
  return { labels, values };
}

async function summary(_req, res, next) {
  try {
    const { crashes, persons } = _getData();

    // KPIs (use numeric totals from crashes.csv; persons table may not list every crash participant)
    const totalCrashes = crashes.length;
    const totalPersons = persons.length;

    const totalInjured =
      sumCrash(crashes, 'number_of_persons_injured');

    const totalKilled =
      sumCrash(crashes, 'number_of_persons_killed');

    const injuredByType = {
      pedestrians: sumCrash(crashes, 'number_of_pedestrians_injured'),
      cyclists:    sumCrash(crashes, 'number_of_cyclist_injured'),
      motorists:   sumCrash(crashes, 'number_of_motorist_injured'),
    };

    const killedByType = {
      pedestrians: sumCrash(crashes, 'number_of_pedestrians_killed'),
      cyclists:    sumCrash(crashes, 'number_of_cyclist_killed'),
      motorists:   sumCrash(crashes, 'number_of_motorist_killed'),
    };

    // Top boroughs (array of {category,count})
    const boroughAC = computeBarCounts({ cat: 'borough', top: 10 });
    const boroughSeries = toSeriesFromCategoryCount(boroughAC);

    // Last 12 months trend (array of {bucket,count})
    const byMonthAC = computeGroupByTime({ date_col: 'crash_date', freq: 'M' }).slice(-12);
    const monthSeries = toSeriesFromBuckets(byMonthAC);

    res.json({
      kpis: {
        totalCrashes,
        totalPersons,
        totalInjured,
        totalKilled,
        injuredByType,
        killedByType
      },

      // convenient shapes for charts
      top: {
        boroughs: {
          data: boroughAC,          // [{ category, count }]
          ...boroughSeries          // { labels:[], values:[] }
        }
      },

      trend: {
        byMonth: {
          data: byMonthAC,          // [{ bucket, count }]
          ...monthSeries            // { labels:[], values:[] }
        }
      }
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { summary };