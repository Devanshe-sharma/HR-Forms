// Test direct route loading
try {
  const express = require('express');
  const capabilityAreasRoutes = require('./routes/capabilityAreas');
  
  console.log('✅ Routes loaded successfully');
  console.log('🔍 Checking if routes is a function:', typeof capabilityAreasRoutes);
  
  // Create a test app
  const app = express();
  app.use('/test', capabilityAreasRoutes);
  
  console.log('✅ Routes mounted successfully on test app');
  
} catch (error) {
  console.log('❌ Error:', error.message);
  console.log('Stack:', error.stack);
}
