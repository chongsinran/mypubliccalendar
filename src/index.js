require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const routes = require('./routes');
app.use(routes);

const port = process.env.PORT || 5001;

const startScheduler = require('./scheduler/telegramScheduler');
startScheduler();

app.listen(port, () => {
  console.log(`Server has started on port ${port}`);
});