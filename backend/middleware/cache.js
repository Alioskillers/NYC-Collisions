// tiny TTL cache for repeated chart queries
const store = new Map();

function key(req) {
  return req.path + '|' + Object.entries(req.query)
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

function get(req) {
  const k = key(req);
  const item = store.get(k);
  if (!item) return null;
  if (Date.now() > item.expires) {
    store.delete(k);
    return null;
  }
  return item.data;
}

function set(req, data, ttlMs = 60_000) {
  const k = key(req);
  store.set(k, { data, expires: Date.now() + ttlMs });
}

module.exports = { get, set };