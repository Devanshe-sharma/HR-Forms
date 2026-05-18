require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const col = mongoose.connection.collection('role_master');
  
  const doc = await col.findOne({});
  console.log('All field names:', Object.keys(doc));
  
  mongoose.disconnect();
});