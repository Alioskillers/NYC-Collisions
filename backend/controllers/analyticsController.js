const {
  scatterXY,
  boxSummary,
  barCounts,
  lineByTime,
  corrMatrix,
  pieCounts,
} = require('./edaController');

function callHandler(handler, query) {
  const fakeReq = { query };
  const fakeRes = {
    payload: null,
    json(data) {
      this.payload = data;
    },
  };

  return Promise.resolve(handler(fakeReq, fakeRes)).then(() => fakeRes.payload);
}

async function analytics(req, res) {
  try {
    const s_x     = (req.query.s_x || 'latitude').toString();
    const s_y     = (req.query.s_y || 'hour').toString();
    const s_limit = Number.isFinite(+req.query.s_limit) ? +req.query.s_limit : 3000;

    const b_col   = (req.query.b_col || 'hour').toString();
    const b_by    = (req.query.b_by  || 'bodily_injury').toString();

    const bar_cat = (req.query.bar_cat || 'bodily_injury').toString();
    const bar_top = Number.isFinite(+req.query.bar_top) ? +req.query.bar_top : 12;

    const line_col  = (req.query.line_col  || 'crash_date').toString();
    const line_freq = (req.query.line_freq || 'M').toString();

    const corr_cols = (req.query.corr_cols || 'latitude,hour')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const pie_cat = (req.query.pie_cat || 'bodily_injury').toString();
    const pie_top = Number.isFinite(+req.query.pie_top) ? +req.query.pie_top : 8;

    const [
      scatter,
      box,
      bar,
      line,
      corr,
      pie,
    ] = await Promise.all([
      callHandler(scatterXY, {
        x: s_x,
        y: s_y,
        limit: String(s_limit),
        from: 'crashes',
      }),

      callHandler(boxSummary, {
        col: b_col,
        by: b_by,
        from: 'persons',
      }),

      callHandler(barCounts, {
        cat: bar_cat,
        top: String(bar_top),
      }),

      callHandler(lineByTime, {
        date_col: line_col,
        freq: line_freq,
      }),

      callHandler(corrMatrix, {
        cols: corr_cols.join(','),
      }),

      callHandler(pieCounts, {
        cat: pie_cat,
        top: String(pie_top),
      }),
    ]);

    res.json({ scatter, box, bar, line, corr, pie });
  } catch (e) {
    console.error('[analytics] error:', e);
    res.status(500).json({
      error: 'analytics_failed',
      message: e?.message || 'Unknown error while aggregating analytics',
    });
  }
}

module.exports = { analytics };