const jwt = require('jsonwebtoken');
const { isId } = require('./ids');

const tokenOptions = { issuer: 'hostel-complaint-system', algorithm: 'HS256' };

function issueToken(user) {
  return jwt.sign({ role: user.role }, process.env.JWT_SECRET, {
    ...tokenOptions,
    subject: String(user.id),
    expiresIn: '1h'
  });
}

function requireAuth(req, res, next) {
  const [, token] = req.get('authorization')?.match(/^Bearer (\S+)$/i) || [];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: tokenOptions.issuer,
      algorithms: [tokenOptions.algorithm]
    });
    const id = Number(claims.sub);
    if (!isId(id) || !['admin', 'warden', 'student'].includes(claims.role)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = { id, role: claims.role };
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  next();
}

function requireManager(req, res, next) {
  if (!['admin', 'warden'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Warden or admin access required' });
  }
  next();
}

module.exports = { issueToken, requireAuth, requireManager };
