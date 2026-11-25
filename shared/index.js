module.exports = {
  ...require('./logger'),
  ...require('./metrics'),
  ...require('./tracing'),
  ...require('./db'),
  ...require('./health')
};
