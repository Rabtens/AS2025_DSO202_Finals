const path = require('node:path');
const { proxyJson } = require('@hostel/shared/proxy');
const { startService } = require('@hostel/shared/service');

startService('frontend', () => require('express'), (app, { express, logger }) => {
  app.use('/api', (req, res) => proxyJson(req, res, logger, process.env.GATEWAY_URL, req.originalUrl));
  app.use(express.static(path.join(__dirname, '../public')));
}, { database: false });
