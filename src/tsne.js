function embedFromEdges(
  nodesMap,
  edgesMap,
  dim,
) {
  const ids = Array.from(nodesMap.keys());
  const idx = new Map(ids.map((id, i) => [String(id), i]));
  const N = ids.length;

  // small random init to break symmetry
  const X = Array.from({ length: N }, () => {
    const arr = new Float32Array(dim);
    for (let d = 0; d < dim; d++) arr[d] = (Math.random() - 0.5) * 1e-3;
    return arr;
  });

  // hyperparams you can tune
  const epochs = 600;           // more epochs = stronger convergence , 150
  let lr = 0.12;                // learning rate (per-edge)
  const lrDecay = 0.995;        // decay lr each epoch
  
  const weightPower = 0.9;
  const centerEvery = 5;       // mean-center every few epochs
  const shrink = 0.999;        // tiny shrink to stabilize magnitudes
  const eps = 1e-8;

  // convert edgesMap entries to array for faster iteration
  let edges = Array.from(edgesMap.entries())
    .map(([k, w]) => {
      const comma = k.indexOf(',');
      const a = idx.get(k.slice(0, comma));
      const b = idx.get(k.slice(comma + 1));

      const sign = Math.sign(w);
      const weight = sign * Math.pow(Math.abs(w), weightPower);
      //console.log(weight)

      return (a == null || b == null) ? null : { a, b, weight };
    })
    .filter(Boolean);

  // normalize
  const weights = edges.map(e => e.weight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);

  edges = edges.map(e => {
    let normWeight = (e.weight - minWeight) / (maxWeight - minWeight);
    return { ...e, weight: normWeight * 128 };
  });

  for (let epoch = 0; epoch < epochs; epoch++) {
    console.log("epoch:", epoch, lr)
    // shuffle edges each epoch to avoid order bias (Fisher-Yates)
    for (let i = edges.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = edges[i]; edges[i] = edges[j]; edges[j] = tmp;
    }

    for (const { a, b, weight } of edges) {
      const xa = X[a];
      const xb = X[b];

      // move both towards midpoint: step = lr * weight * (xb - xa) / 2
      for (let d = 0; d < dim; d++) {
        const diff = xb[d] - xa[d];
        const step = 0.5 * lr * weight * diff;
        xa[d] += step;
        xb[d] -= step; // note: subtracting here moves xb toward xa
      }
    }

    // tiny shrink to keep numbers stable
    for (let i = 0; i < N; i++) {
      const xi = X[i];
      for (let d = 0; d < dim; d++) xi[d] *= shrink;
    }

    // mean-center periodicly to prevent drifting far from origin
    if ((epoch % centerEvery) === 0) {
      const mean = new Float32Array(dim);
      for (let i = 0; i < N; i++) {
        const xi = X[i];
        for (let d = 0; d < dim; d++) mean[d] += xi[d];
      }
      for (let d = 0; d < dim; d++) mean[d] /= Math.max(1, N);

      for (let i = 0; i < N; i++) {
        const xi = X[i];
        for (let d = 0; d < dim; d++) xi[d] -= mean[d];
      }
    }

    lr *= lrDecay;
  }

  return {
    ids,
    data: X.map(v => Array.from(v)),
  };
}


//

const UMAPpkg = require('umap-js');
const UMAP = UMAPpkg.UMAP
async function tsneFromGraph(nodesMap, edgesMap, {
  embedDim = 256,      // kept for compatibility with embedFromEdges
  nNeighbors = 60,     // approx analogous to perplexity
  minDist = 0.04,
  nIter = 500,         // number of epochs for UMAP
} = {}) {
  console.log('embedding graph (edge-sum vectors)');
  const { ids, data } = embedFromEdges(nodesMap, edgesMap, embedDim);

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
    spread: 1,
    repulsionStrength: 1,
    //negativeSampleRate: 10,
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
