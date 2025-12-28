const { downloadAsBase64, uploadCoords } = require('./firebase/mainfdb.js')

const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);
const gzip = promisify(zlib.gzip);

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

/** strip optional data:...;base64, prefix and return Buffer */
function b64ToBuffer(b64) {
  if (!b64 || typeof b64 !== 'string') throw new TypeError('expected base64 string');
  const m = b64.match(/^data:([a-zA-Z0-9\/.+-]+);base64,(.*)$/);
  const raw = m ? m[2] : b64;
  return Buffer.from(raw, 'base64');
}

async function decompressBufferWithFallback(buf) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('expected Buffer');

  const first = buf[0];
  const second = buf[1] || 0;

  if (first === 0x1f && second === 0x8b) {
    return await gunzip(buf);
  }

  if (first === 0x78) {
    try {
      return await inflate(buf);
    } catch (err) {
      // try raw if inflate fails
      return await inflateRaw(buf);
    }
  }

  // fallback: try inflateRaw, then inflate, then gunzip
  try { return await inflateRaw(buf); } catch (e1) {}
  try { return await inflate(buf); } catch (e2) {}
  try { return await gunzip(buf); } catch (e3) { 
    // all failed
    const err = new Error('All decompression methods failed');
    err.details = { e1: e1?.message, e2: e2?.message, e3: e3?.message };
    throw err;
  }
}


async function decompressBase64ToObjects(base64Str) {
  const buf = b64ToBuffer(base64Str);

  const decompressedBuf = await decompressBufferWithFallback(buf);
  const jsonStr = decompressedBuf.toString('utf8');

  const parsed = JSON.parse(jsonStr);
  const nodes = restore(parsed.nodes);
  const edges = restore(parsed.edges);

  return { nodes, edges };
}

//

const { tsneFromGraph } = require('./tsne.js')

async function startVis() {
    const b64 = await downloadAsBase64()
    const { nodes, edges } = await decompressBase64ToObjects(b64);
    console.log("starting tsne")
    const coords = await tsneFromGraph(nodes, edges);

    console.log("serializing coords..", typeof(coords))

    // JSON stringify and gzip
    const jsonStr = JSON.stringify(coords);

    //console.log(jsonStr)
    const gzBuffer = await gzip(Buffer.from(jsonStr, 'utf8'));

    // upload gzipped buffer
    await uploadCoords(gzBuffer);

    console.log(`uploaded coords (gzipped) — size: ${gzBuffer.length} bytes`)
}

module.exports = {
    startVis
}