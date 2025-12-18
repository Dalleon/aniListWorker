const UMAPpkg = require('umap-js');
const UMAP = UMAPpkg.UMAP

function embedFromEdges(
  nodesMap,
  edgesMap,
  {
    dim = 64,
    useWeights = true,
    binary = false,
  } = {}
) {
  const ids = Array.from(nodesMap.keys());
  const idx = new Map(ids.map((id, i) => [String(id), i]));
  const N = ids.length;

  const X = Array.from({ length: N }, () => new Float32Array(dim));
  const scale = 1 / Math.sqrt(dim);

  for (const [key, w] of edgesMap.entries()) {
    const comma = key.indexOf(',');
    const a = idx.get(key.slice(0, comma));
    const b = idx.get(key.slice(comma + 1));
    if (a == null || b == null) continue;

    const weight = binary
      ? 1
      : (useWeights ? (Number(w) || 1) : 1);

    const sign = Math.random() < 0.5 ? -scale : scale;

    const xa = X[a];
    const xb = X[b];

    for (let d = 0; d < dim; d++) {
      const v = sign * weight;
      xa[d] += v;
      xb[d] += v;
    }
  }

  return {
    ids,
    data: X.map(v => Array.from(v)), // JS arrays for downstream libs
  };
}

async function tsneFromGraph(nodesMap, edgesMap, {
  embedDim = 64,       // kept for compatibility with embedFromEdges
  nNeighbors = 15,     // approx analogous to perplexity
  minDist = 0.1,
  nIter = 500,         // number of epochs for UMAP
} = {}) {
  console.log('embedding graph (edge-sum vectors)');
  const { ids, data } = embedFromEdges(nodesMap, edgesMap, {
    dim: embedDim
  });

  if (!data || data.length === 0) {
    return {};
  }

  console.log('running UMAP (umap-js)', data.length);
  // create UMAP instance — many versions accept these options, but we guard
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors,
    minDist,
    nEpochs: nIter,
  });

  console.log("umap initialize, fitting")

  umap.initializeFit(data);

  console.log("initialized")

  for (let epoch = 0; epoch < nIter; epoch++) {
    umap.step();
    console.log(`UMAP epoch ${epoch + 1}/${nIter}`);
  }

  const Y = umap.getEmbedding();
  console.log("embedding done", Y.length)
  console.log("scaling...")
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of Y) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const spanX = (maxX - minX) || 1;
  const spanY = (maxY - minY) || 1;

  const coords = {};
  ids.forEach((id, i) => {
    coords[id] = {
      x: (Y[i][0] - minX) / spanX,
      y: (Y[i][1] - minY) / spanY,
    };
  });

  return coords;
}

module.exports = {
  tsneFromGraph
};
