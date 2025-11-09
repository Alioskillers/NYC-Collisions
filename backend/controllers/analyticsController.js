// server/controllers/analyticsController.js
const {
  computeScatter,
  computeBox,
  computeBarCounts,
  computeGroupByTime,
  computeCorr,
  computePieCounts
} = require('./edaController');

/**
 * Aggregated analytics endpoint.
 * It returns the SAME shapes as the individual /api/eda/* endpoints,
 * bundled together so the frontend can hydrate all charts in one request.
 *
 * You can override defaults via query params (optional):
 *   /api/analytics?
 *     s_x=latitude&s_y=hour&s_limit=3000&
 *     b_col=hour&b_by=bodily_injury&
 *     bar_cat=bodily_injury&bar_top=12&
 *     line_col=crash_date&line_freq=M&
 *     corr_cols=latitude,hour&
 *     pie_cat=bodily_injury&pie_top=8
 */
async function analytics(req, res, next) {
  try {
    // ---- read overrides (fallback to defaults used across the app) ----
    const s_x     = (req.query.s_x || 'latitude').toString();
    const s_y     = (req.query.s_y || 'hour').toString();
    const s_limit = Number.isFinite(+req.query.s_limit) ? +req.query.s_limit : 3000;

    const b_col   = (req.query.b_col || 'hour').toString();
    const b_by    = (req.query.b_by  || 'bodily_injury').toString();

    const bar_cat = (req.query.bar_cat || 'bodily_injury').toString();
    const bar_top = Number.isFinite(+req.query.bar_top) ? +req.query.bar_top : 12;

    const line_col  = (req.query.line_col  || 'crash_date').toString();
    const line_freq = (req.query.line_freq || 'M').toString(); // 'Y' | 'M'

    const corr_cols = (req.query.corr_cols || 'latitude,hour')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const pie_cat = (req.query.pie_cat || 'bodily_injury').toString();
    const pie_top = Number.isFinite(+req.query.pie_top) ? +req.query.pie_top : 8;

    // ---- compute everything (wrap sync fns in Promise.resolve for parity) ----
    const [
      scatter,
      box,
      bar,
      line,
      corr,
      pie
    ] = await Promise.all([
      Promise.resolve(computeScatter({ x: s_x, y: s_y, limit: s_limit })),
      Promise.resolve(computeBox({ col: b_col, by: b_by })),
      Promise.resolve(computeBarCounts({ cat: bar_cat, top: bar_top })),
      Promise.resolve(computeGroupByTime({ date_col: line_col, freq: line_freq })),
      Promise.resolve(computeCorr({ cols: corr_cols })),
      Promise.resolve(computePieCounts({ cat: pie_cat, top: pie_top })),
    ]);

    // Important: keep keys EXACTLY as the frontend expects
    // (scatter, box, bar, line, corr, pie) and pass through the shapes
    // returned by the compute* helpers (which mirror /api/eda/* endpoints).
    res.json({ scatter, box, bar, line, corr, pie });
  } catch (e) {
    // Do not break the whole page if one chart fails; return partial data + errors.
    // If you prefer to fail-fast, replace this block with next(e).
    console.error('[analytics] error:', e);
    res.status(500).json({
      error: 'analytics_failed',
      message: e?.message || 'Unknown error while aggregating analytics'
    });
  }
}

module.exports = { analytics };