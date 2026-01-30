require('dotenv').config();
require('dotenv').config({ path: './backend-node/.env' });
console.log(
  "ENV LOADED:",
  !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON
);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');


const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Backend server is alive!');
});

app.use('/api/employees', require('./routes/employees'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/designations', require('./routes/designations'));
app.use('/api/hiringrequisitions', require('./routes/hiringRequisitions'));
app.use('/api/ctc-components', require('./routes/ctcComponents'));
app.use('/api/training', require('./routes/training'));
app.use('/api/requisition', require('./routes/requisition'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/exit', require('./routes/exit'));


mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Mongo connected'))
    .catch(err => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Node running on ${PORT}`);
});

// server.js
app.post('/sync-sheet', async (req, res) => {
  try {
    const data = req.body; // row or full sheet
    await Employee.updateOne(
      { sheetRowId: data.sheetRowId },
      { $set: data },
      { upsert: true }
    );
    res.send({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
});
