const { proxyJson } = require('@hostel/shared/proxy');
const { startService } = require('@hostel/shared/service');

startService('api-gateway', () => require('express'), (app, { logger }) => {
  const forward = (target, getPath = (req) => req.originalUrl) =>
    (req, res) => proxyJson(req, res, logger, target, getPath(req));

  app.post('/api/auth/login', forward(process.env.LOGIN_URL));
  app.post('/api/auth/register', forward(process.env.REGISTER_URL));
  app.get('/api/users/me', forward(process.env.USER_URL));
  app.get('/api/categories', forward(process.env.CATEGORY_URL, () => '/categories'));
  app.route('/api/complaints')
    .get(forward(process.env.COMPLAINT_URL))
    .post(forward(process.env.COMPLAINT_URL));
  app.get('/api/complaints/:id', forward(process.env.COMPLAINT_URL));
  app.get('/api/hostels', forward(process.env.HOSTEL_URL));
  app.get('/api/staff', forward(process.env.STAFF_URL));
  app.patch('/api/complaints/:id/priority', forward(process.env.PRIORITY_URL));
  app.put('/api/complaints/:id/assignment', forward(process.env.ASSIGNMENT_URL));
  app.patch('/api/complaints/:id/status', forward(process.env.STATUS_URL));
  app.get('/api/complaints/:id/status-history', forward(process.env.STATUS_URL));
  app.route('/api/notifications')
    .get(forward(process.env.NOTIFICATION_URL))
    .post(forward(process.env.NOTIFICATION_URL));
  app.patch('/api/notifications/:id/read', forward(process.env.NOTIFICATION_URL));
  app.route('/api/complaints/:id/feedback')
    .get(forward(process.env.FEEDBACK_URL))
    .post(forward(process.env.FEEDBACK_URL));
  app.route('/api/announcements')
    .get(forward(process.env.ANNOUNCEMENT_URL))
    .post(forward(process.env.ANNOUNCEMENT_URL));
  app.get('/api/reports/daily', forward(process.env.REPORT_URL));
}, { database: false });
