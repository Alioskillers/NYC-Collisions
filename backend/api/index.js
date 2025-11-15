// backend/api/index.js
const serverless = require('serverless-http');
const app = require('../server'); // the file above

module.exports = serverless(app);