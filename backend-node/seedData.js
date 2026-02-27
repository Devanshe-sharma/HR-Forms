// Simple data seeding for the 4-model training system
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// Sample data
const sampleCapabilityAreas = [
  { capabilityAreaId: 'CA_LEAD_001', capabilityArea: 'Leadership', createdBy: 'System' },
  { capabilityAreaId: 'CA_TECH_002', capabilityArea: 'Technical Skills', createdBy: 'System' },
  { capabilityAreaId: 'CA_COMM_003', capabilityArea: 'Communication', createdBy: 'System' },
  { capabilityAreaId: 'CA_MGMT_004', capabilityArea: 'Management', createdBy: 'System' },
];

const sampleCapabilitySkills = [
  { capabilitySkill: 'Team Leadership', isGeneric: false, capabilityArea: 'Leadership' },
  { capabilitySkill: 'Strategic Planning', isGeneric: false, capabilityArea: 'Leadership' },
  { capabilitySkill: 'JavaScript Programming', isGeneric: false, capabilityArea: 'Technical Skills' },
  { capabilitySkill: 'Database Management', isGeneric: true, capabilityArea: 'Technical Skills' },
  { capabilitySkill: 'Public Speaking', isGeneric: true, capabilityArea: 'Communication' },
  { capabilitySkill: 'Business Writing', isGeneric: true, capabilityArea: 'Communication' },
  { capabilitySkill: 'Project Management', isGeneric: false, capabilityArea: 'Management' },
  { capabilitySkill: 'Budget Planning', isGeneric: false, capabilityArea: 'Management' },
];

const sampleTrainingTopics = [
  {
    trainingName: 'Advanced Leadership Workshop',
    trainerName: 'John Smith',
    capabilityArea: 'Leadership',
    capabilitySkill: 'Team Leadership',
    type: 'Role Specific',
    isGeneric: false,
    proposedScheduleDate: '2026-03-15',
    contentPdfLink: 'https://example.com/leadership-content.pdf',
    videoLink: 'https://example.com/leadership-video',
    assessmentLink: 'https://example.com/leadership-assessment',
    status: 'Pending Approval',
    createdBy: 'HR Department',
  },
  {
    trainingName: 'JavaScript Best Practices',
    trainerName: 'Jane Doe',
    capabilityArea: 'Technical Skills',
    capabilitySkill: 'JavaScript Programming',
    type: 'Dept Specific',
    isGeneric: false,
    proposedScheduleDate: '2026-03-20',
    contentPdfLink: 'https://example.com/js-content.pdf',
    videoLink: 'https://example.com/js-video',
    assessmentLink: 'https://example.com/js-assessment',
    status: 'Draft',
    createdBy: 'HR Department',
  },
  {
    trainingName: 'Effective Communication Skills',
    trainerName: 'Mike Johnson',
    capabilityArea: 'Communication',
    capabilitySkill: 'Public Speaking',
    type: 'Generic',
    isGeneric: true,
    proposedScheduleDate: '2026-03-25',
    contentPdfLink: 'https://example.com/communication-content.pdf',
    videoLink: 'https://example.com/communication-video',
    assessmentLink: 'https://example.com/communication-assessment',
    status: 'Approved',
    createdBy: 'HR Department',
  },
];

async function seedData() {
  try {
    console.log('🌱 Starting data seeding...');

    // Seed capability areas
    console.log('📁 Seeding capability areas...');
    for (const area of sampleCapabilityAreas) {
      try {
        await axios.post(`${API_BASE}/capability-areas`, area, {
          headers: { 'x-user-role': 'Admin' }
        });
        console.log(`✅ Created capability area: ${area.capabilityArea}`);
      } catch (error) {
        console.log(`⚠️  Capability area already exists or error: ${area.capabilityArea}`);
      }
    }

    // Get capability areas for mapping
    console.log('🔍 Getting capability areas for mapping...');
    const areasResponse = await axios.get(`${API_BASE}/capability-areas`, {
      headers: { 'x-user-role': 'Admin' }
    });
    const areas = areasResponse.data.data;
    console.log(`📊 Found ${areas.length} capability areas`);

    // Seed capability skills
    console.log('🎯 Seeding capability skills...');
    for (const skill of sampleCapabilitySkills) {
      const area = areas.find(a => a.capabilityArea === skill.capabilityArea);
      if (area) {
        try {
          console.log(`📝 Creating skill: ${skill.capabilitySkill} for area: ${area.capabilityArea} (${area._id})`);
          const response = await axios.post(`${API_BASE}/capability-skills`, {
            ...skill,
            capabilityId: area._id,
            createdBy: 'System',
          }, {
            headers: { 'x-user-role': 'Admin' }
          });
          console.log(`✅ Created capability skill: ${skill.capabilitySkill}`);
        } catch (error) {
          console.log(`⚠️  Capability skill error - ${skill.capabilitySkill}:`, error.response?.status, error.response?.data?.error || error.message);
        }
      } else {
        console.log(`❌ Could not find area for skill: ${skill.capabilitySkill}`);
      }
    }

    // Seed training topics
    console.log('📚 Seeding training topics...');
    for (const topic of sampleTrainingTopics) {
      try {
        await axios.post(`${API_BASE}/training-topics`, topic, {
          headers: { 'x-user-role': 'HR' }
        });
        console.log(`✅ Created training topic: ${topic.trainingName}`);
      } catch (error) {
        console.log(`⚠️  Training topic already exists or error: ${topic.trainingName}`);
      }
    }

    console.log('🎉 Data seeding completed!');
    console.log('\n📊 Summary:');
    console.log('- Capability Areas: 4');
    console.log('- Capability Skills: 8');
    console.log('- Training Topics: 3');
    console.log('\n🌐 You can now test the system at: http://localhost:5175/training-page');

  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
    console.log('🔧 Stack:', error.stack);
  }
}

// Run the seeding
seedData();
