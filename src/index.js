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

//

const { upload } = require('./firebase/mainfdb.js')
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
async function startWorker() {
    while (true) {
        const { nodes, edges } = await runInit();
        //console.log(nodes, edges);

        try {
          const gzBuffer = await compressAsync(nodes, edges);
          console.log('Compressed bytes:', gzBuffer.length);

          const chunkSize = 800 * 1024; // 800 KB raw
          const chunks = {};
          let chunkIndex = 1;
          for (let i = 0; i < gzBuffer.length; i += chunkSize) {
            const chunk = gzBuffer.slice(i, i + chunkSize).toString('base64');
            chunks[`data${chunkIndex}`] = chunk;
            chunkIndex++;
          }
          await upload(chunks);

          
          console.log("uploaded")

          const { nodes: n2, edges: e2 } = await decompressAsync(gzBuffer);
          console.log('Restored:', n2.size, e2.size);
        } catch (err) {
          console.warn(err)
        }

        await sleep(1000);
        
    }
}

startWorker();