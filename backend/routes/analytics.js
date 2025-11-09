const express = require('express');
const router = express.Router();
const cache = require('../middleware/cache');
const { analytics } = require('../controllers/analyticsController');

const withCache = (ttlMs = 60_000) => (req, res, next) => {
  const hit = cache.get(req);
  if (hit) return res.json(hit);
  const _json = res.json.bind(res);
  res.json = (payload) => { cache.set(req, payload, ttlMs); return _json(payload); };
  next();
};

router.get('/', withCache(30_000), analytics);

module.exports = router;