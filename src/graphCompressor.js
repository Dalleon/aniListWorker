const zlib = require('zlib');

function normalize(value) {
  if (value instanceof Map) {
    return {
      __type: 'Map',
      value: Array.from(value.entries()).map(([k, v]) => [k, normalize(v)])
    };
  }
  if (value instanceof Set) {
    return { __type: 'Set', value: Array.from(value).map(v => normalize(v)) };
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

function restore(value) {
  if (value && value.__type === 'Map') {
    return new Map(value.value.map(([k, v]) => [k, restore(v)]));
  }
  if (value && value.__type === 'Set') {
    return new Set(value.value.map(restore));
  }
  if (Array.isArray(value)) return value.map(restore);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = restore(v);
    return out;
  }
  return value;
}

function compress(nodes, edges, cb) {
  try {
    const payload = {
      nodes: normalize(nodes),
      edges: normalize(edges)
    };
    const json = JSON.stringify(payload);
    const buf = Buffer.from(json, 'utf8');
    zlib.gzip(buf, (err, gz) => {
      if (err) return cb(err);
      cb(null, gz);
    });
  } catch (err) {
    cb(err);
  }
}

function decompress(gzBuffer, cb) {
  zlib.gunzip(gzBuffer, (err, buf) => {
    if (err) return cb(err);
    try {
      const parsed = JSON.parse(buf.toString('utf8'));
      const nodes = restore(parsed.nodes);
      const edges = restore(parsed.edges);
      cb(null, { nodes, edges });
    } catch (e) {
      cb(e);
    }
  });
}

async function compressAsync(nodes, edges) {
  return new Promise((resolve, reject) => {
    compress(nodes, edges, (err, gz) => {
      if (err) reject(err);
      else resolve(gz);
    });
  });
}

async function decompressAsync(gzBuffer) {
  return new Promise((resolve, reject) => {
    decompress(gzBuffer, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

module.exports = {
  compress,
  decompress,
  compressAsync,
  decompressAsync
};