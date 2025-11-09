const express = require('express');
const router = express.Router();

const cache = require('../middleware/cache'); // see file below

const {
  lineByTime,
  barCounts,
  pieCounts,
  scatterXY,
  boxSummary,
  corrMatrix,
  histCounts,
} = require('../controllers/edaController');

// simple ttl cache per query
const withCache = (ttlMs = 60_000) => (req, res, next) => {
  const hit = cache.get(req);
  if (hit) return res.json(hit);
  const _json = res.json.bind(res);
  res.json = (payload) => { cache.set(req, payload, ttlMs); return _json(payload); };
  next();
};

router.get('/line',    withCache(), lineByTime);
router.get('/bar',     withCache(), barCounts);
router.get('/pie',     withCache(), pieCounts);
router.get('/scatter', withCache(), scatterXY);
router.get('/box',     withCache(), boxSummary);
router.get('/corr',    withCache(), corrMatrix);
router.get('/hist',    withCache(), histCounts);

module.exports = router;