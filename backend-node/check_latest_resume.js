require('dotenv').config();
const mongoose = require('mongoose');
const CandidateApplication = require('./models/Candidateapplication');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const doc = await CandidateApplication.findOne().sort({ createdAt: -1 });
  console.log({ full_name: doc.full_name, resume: doc.resume });
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
