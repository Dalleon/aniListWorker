const PCA = require('ml-pca').PCA;
const tsnejs = require('tsne-js');

function adjacencyDenseFlat(nodesMap, edgesMap, { useWeights = true, binary = false } = {}) {
  const ids = Array.from(nodesMap.keys());
  const idxOf = new Map(ids.map((id, i) => [String(id), i]));
  const N = ids.length;

  // single contiguous buffer (MUCH less overhead)
  const data = new Float32Array(N * N);

  for (const [key, w] of edgesMap.entries()) {
    const comma = key.indexOf(',');
    const aStr = key.slice(0, comma);
    const bStr = key.slice(comma + 1);
    const ai = idxOf.get(aStr);
    const bi = idxOf.get(bStr);
    if (ai == null || bi == null) continue;

    const weight = binary ? 1 : (useWeights ? (Number(w) || 0) : 1);
    data[ai * N + bi] = weight;
    data[bi * N + ai] = weight;
  }

  return { ids, data, N };
}

async function tsneFromAdjDense(nodesMap, edgesMap, {
  pcaComponents = 50,
  tsneIter = 800,
  perplexity = 30,
} = {}) {
  console.log('building dense adjacency');
  const { ids, data, N } = adjacencyDenseFlat(nodesMap, edgesMap);

  const nComp = Math.min(pcaComponents, N - 1);
  console.log('PCA components:', nComp);

  // ml-pca still wants rows → we give views, not copies
  const rows = Array.from({ length: N }, (_, i) =>
    data.subarray(i * N, (i + 1) * N)
  );

  console.log("rows for pca ready")

  const pca = new PCA(rows, {
    method: 'NIPALS',
    nCompNIPALS: 50,
    center: true,
    scale: false,
  });

  console.log("reducing...")

  const reduced = pca.predict(rows, { nComponents: nComp }).to2DArray();

  console.log('running t-SNE');
  const model = new tsnejs.tSNE({ dim: 2, perplexity });
  model.initDataRaw(reduced);

  for (let i = 0; i < tsneIter; i++) model.step();

  const Y = model.getSolution();
  const coords = {};
  ids.forEach((id, i) => (coords[id] = { x: Y[i][0], y: Y[i][1] }));
  return coords;
}

module.exports = { tsneFromAdjDense };
