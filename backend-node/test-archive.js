// Simple test script to verify archive functionality
// Run this with: node test-archive.js

const mongoose = require('mongoose');
const Employee = require('./models/Employee');

async function testArchiveFunction() {
  try {
    // Connect to database (make sure MONGO_URI is set in .env)
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hr-forms');
    console.log('Connected to MongoDB');

    // Check if archive fields exist in schema
    const testEmployee = await Employee.findOne();
    if (testEmployee) {
      console.log('Sample employee found:', testEmployee.full_name);
      console.log('isArchived field exists:', 'isArchived' in testEmployee.toObject());
      console.log('archivedAt field exists:', 'archivedAt' in testEmployee.toObject());
      
      // Test archive operation
      console.log('Testing archive operation...');
      await Employee.findByIdAndUpdate(testEmployee._id, {
        isArchived: true,
        archivedAt: new Date()
      });
      
      const archivedEmployee = await Employee.findById(testEmployee._id);
      console.log('Archive test result:', {
        isArchived: archivedEmployee.isArchived,
        archivedAt: archivedEmployee.archivedAt
      });
      
      // Test unarchive operation
      console.log('Testing unarchive operation...');
      await Employee.findByIdAndUpdate(testEmployee._id, {
        isArchived: false,
        archivedAt: null
      });
      
      const unarchivedEmployee = await Employee.findById(testEmployee._id);
      console.log('Unarchive test result:', {
        isArchived: unarchivedEmployee.isArchived,
        archivedAt: unarchivedEmployee.archivedAt
      });
      
      console.log('Archive functionality test completed successfully!');
    } else {
      console.log('No employees found in database');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testArchiveFunction();
