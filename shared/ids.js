function isId(value) {
  return Number.isInteger(value) && value >= 1 && value <= 2147483647;
}

function complaintId(req, res, next) {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !isId(id)) {
    return res.status(400).json({ error: 'Invalid complaint ID' });
  }
  req.complaintId = id;
  next();
}

module.exports = { isId, complaintId };
