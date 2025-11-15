// backend/server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

const { loadAll } = require('./utils/dataStore');

const edaRoutes = require('./routes/eda');
const summaryRoutes = require('./routes/summary');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 8000;

// --- common middleware
app.use(compression());
app.use(cors());

// --- security headers
const isProd = process.env.NODE_ENV === 'production';
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'connect-src': ["'self'", 'ws:', 'wss:'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'", 'data:'],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"], // Plotly/MUI inline style allowance
      'worker-src': ["'self'", 'blob:'],
      'object-src': ["'none'"],
      'frame-ancestors': ["'self'"],
      'upgrade-insecure-requests': [],
    },
  })
);

// --- health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- API routes
app.use('/api/eda', edaRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/analytics', analyticsRoutes);

// If you are serving the React build from a separate Vercel frontend,
// you can REMOVE everything below this comment.
// If you want to keep it for local full-stack serving, leave it.

// --- serve React build on same origin in production (local / optional)
const clientDir = path.join(__dirname, '../frontend/dist'); // Vite/CRA build output
app.use(express.static(clientDir, { extensions: ['html'] }));

// SPA fallback: serve index.html for any non-API route
app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// ---------- CSV / data loading (run once per cold start) ----------
let dataLoadedPromise = (async () => {
  try {
    const counts = await loadAll();
    console.log(`[loader] crashes: ${counts.crashes}, persons: ${counts.persons}`);
  } catch (e) {
    console.error('Failed to load CSVs:', e);
    // On Vercel, we do NOT exit the process; just log the error.
    // Locally, we'll handle it below.
  }
})();

// Export the app for serverless (Vercel)
module.exports = app;

// ---------- Local dev: only listen if run directly ----------
if (require.main === module) {
  (async () => {
    try {
      await dataLoadedPromise;
      app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
      });
    } catch (e) {
      console.error('Startup failed:', e);
      process.exit(1);
    }
  })();
}