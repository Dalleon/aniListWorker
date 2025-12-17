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

const envDecrypt = require('./FallbackEncryption/envDecrypt.js')
async function uploadToDropbox(gzBuffer, filename = 'graph.gz') {
  const dropboxToken = envDecrypt(process.env.workerKey, process.env.dropboxToken);
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + dropboxToken,
      'Dropbox-API-Arg': JSON.stringify({
        path: `/${filename}`,
        mode: 'overwrite',
        autorename: false,
        mute: false
      }),
      'Content-Type': 'application/octet-stream'
    },
    body: gzBuffer
  });

  if (!res.ok) {
    throw new Error(`Dropbox upload failed: ${await res.text()}`);
  }

  return res.json();
}

//

async function startWorker() {
    while (true) {
        const { nodes, edges } = await runInit();
        //console.log(nodes, edges);

        try {
          const gzBuffer = await compressAsync(nodes, edges);
          console.log('Compressed bytes:', gzBuffer.length);

          const uploadRes = await uploadToDropbox(gzBuffer);
          console.log("upload res: ", uploadRes)

          const { nodes: n2, edges: e2 } = await decompressAsync(gzBuffer);
          console.log('Restored:', n2.size, e2.size);
        } catch (err) {
          console.warn(err)
        }
    }
}

startWorker();