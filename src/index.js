const dotenv = require('dotenv');
const dotenvResult = dotenv.config();
if (dotenvResult && dotenvResult.error) {
  console.log("DOT ENV]", dotenvResult.error)
}

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

const { runInit } = require('./worker.js')
const { compressAsync, decompressAsync } = require('./graphCompressor');
async function startWorker() {
    while (true) {
        const { nodes, edges } = await runInit();
        console.log(nodes, edges);

        try {
          const gzBuffer = await compressAsync(nodes, edges);
          console.log('Compressed bytes:', gzBuffer.length);

          const { nodes: n2, edges: e2 } = await decompressAsync(gzBuffer);
          console.log('Restored:', n2.size, e2.size);
        } catch (err) {
          console.warn(err)
        }
    }
}

startWorker();