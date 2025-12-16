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

const { start } = require('./worker.js')
async function startWorker() {
    while (true) {
        const { nodes, edges } = await start();
        console.log(nodes, edges);
    }
}

startWorker();