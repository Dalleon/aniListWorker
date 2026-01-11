const dotenv = require('dotenv');
const dotenvResult = dotenv.config();
if (dotenvResult && dotenvResult.error) {
  console.log("DOT ENV]", dotenvResult.error)
}

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('./src/public'));

/*app.get('/', (req, res) => {
  res.send('Hello World!');
});*/

const Body = require('./public/Body').default;
const b = new Body();
console.log(b);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});