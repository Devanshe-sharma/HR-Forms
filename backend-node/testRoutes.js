// Simple test to check if routes are working
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testRoutes() {
  try {
    console.log('🧪 Testing API routes...');

    // Test existing route
    console.log('\n📋 Testing existing /employees route:');
    try {
      const response = await axios.get(`${API_BASE}/employees`, {
        headers: { 'x-user-role': 'Admin' }
      });
      console.log('✅ Employees route works:', response.data.success);
    } catch (error) {
      console.log('❌ Employees route failed:', error.response?.status || error.message);
    }

    // Test new capability areas route
    console.log('\n📁 Testing new /capability-areas route:');
    try {
      const response = await axios.get(`${API_BASE}/capability-areas`, {
        headers: { 'x-user-role': 'Admin' }
      });
      console.log('✅ Capability areas route works:', response.data.success);
      console.log('📊 Data:', response.data.data);
    } catch (error) {
      console.log('❌ Capability areas route failed:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('Error details:', error.response.data);
      }
    }

    // Test new capability skills route
    console.log('\n🎯 Testing new /capability-skills route:');
    try {
      const response = await axios.get(`${API_BASE}/capability-skills`, {
        headers: { 'x-user-role': 'Admin' }
      });
      console.log('✅ Capability skills route works:', response.data.success);
      console.log('📊 Data:', response.data.data);
    } catch (error) {
      console.log('❌ Capability skills route failed:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('Error details:', error.response.data);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRoutes();
