const mongoose = require('mongoose');
const { Employee, DeptKPI, RoleKPI, DeptTargets, RoleTargets, Hygiene, Growth } = require('./models/pmsModels');

// Sample data
const sampleEmployees = [
  { name: 'John Doe', email: 'john@company.com', department: 'Engineering', designation: 'Senior Developer', employeeId: 'EMP001' },
  { name: 'Jane Smith', email: 'jane@company.com', department: 'Engineering', designation: 'Developer', employeeId: 'EMP002' },
  { name: 'Mike Johnson', email: 'mike@company.com', department: 'HR', designation: 'HR Manager', employeeId: 'EMP003' },
  { name: 'Sarah Wilson', email: 'sarah@company.com', department: 'Sales', designation: 'Sales Executive', employeeId: 'EMP004' },
  { name: 'David Brown', email: 'david@company.com', department: 'Marketing', designation: 'Marketing Manager', employeeId: 'EMP005' }
];

const sampleDeptKPIs = [
  { name: 'Code Quality', department: 'Engineering', targetValue: 95, achievedValue: 88 },
  { name: 'Project Delivery', department: 'Engineering', targetValue: 12, achievedValue: 14 },
  { name: 'Team Productivity', department: 'Engineering', targetValue: 85, achievedValue: 82 },
  { name: 'Customer Satisfaction', department: 'Sales', targetValue: 90, achievedValue: 92 },
  { name: 'Revenue Growth', department: 'Sales', targetValue: 15, achievedValue: 12 }
];

const sampleRoleKPIs = [
  { name: 'Code Quality', role: 'Senior Developer', employeeId: 'EMP001', targetValue: 95, achievedValue: 92 },
  { name: 'Code Quality', role: 'Developer', employeeId: 'EMP002', targetValue: 90, achievedValue: 85 },
  { name: 'Team Management', role: 'HR Manager', employeeId: 'EMP003', targetValue: 80, achievedValue: 85 },
  { name: 'Sales Target', role: 'Sales Executive', employeeId: 'EMP004', targetValue: 100, achievedValue: 105 },
  { name: 'Campaign Performance', role: 'Marketing Manager', employeeId: 'EMP005', targetValue: 75, achievedValue: 70 }
];

const sampleDeptTargets = [
  { name: 'Training Hours', department: 'Engineering', targetValue: 40, achievedValue: 38 },
  { name: 'Bug Reduction', department: 'Engineering', targetValue: 20, achievedValue: 22 },
  { name: 'Hiring Goals', department: 'HR', targetValue: 5, achievedValue: 4 },
  { name: 'Sales Quota', department: 'Sales', targetValue: 500000, achievedValue: 520000 },
  { name: 'Brand Awareness', department: 'Marketing', targetValue: 70, achievedValue: 65 }
];

const sampleRoleTargets = [
  { name: 'Technical Skills', role: 'Senior Developer', employeeId: 'EMP001', targetValue: 100, achievedValue: 95 },
  { name: 'Technical Skills', role: 'Developer', employeeId: 'EMP002', targetValue: 90, achievedValue: 88 },
  { name: 'Team Leadership', role: 'HR Manager', employeeId: 'EMP003', targetValue: 80, achievedValue: 85 },
  { name: 'Sales Performance', role: 'Sales Executive', employeeId: 'EMP004', targetValue: 100, achievedValue: 105 },
  { name: 'Marketing ROI', role: 'Marketing Manager', employeeId: 'EMP005', targetValue: 150, achievedValue: 140 }
];

const sampleHygieneData = [
  { 
    employeeId: 'EMP001', 
    attendance: { present: 22, total: 23, percentage: 95.7 }, 
    lateMarks: 1, 
    leaves: { taken: 2, allowed: 12, remaining: 10 }, 
    outOfOffice: 3 
  },
  { 
    employeeId: 'EMP002', 
    attendance: { present: 21, total: 23, percentage: 91.3 }, 
    lateMarks: 2, 
    leaves: { taken: 3, allowed: 12, remaining: 9 }, 
    outOfOffice: 1 
  },
  { 
    employeeId: 'EMP003', 
    attendance: { present: 23, total: 23, percentage: 100 }, 
    lateMarks: 0, 
    leaves: { taken: 1, allowed: 12, remaining: 11 }, 
    outOfOffice: 2 
  },
  { 
    employeeId: 'EMP004', 
    attendance: { present: 20, total: 23, percentage: 87 }, 
    lateMarks: 3, 
    leaves: { taken: 4, allowed: 12, remaining: 8 }, 
    outOfOffice: 2 
  },
  { 
    employeeId: 'EMP005', 
    attendance: { present: 22, total: 23, percentage: 95.7 }, 
    lateMarks: 1, 
    leaves: { taken: 2, allowed: 12, remaining: 10 }, 
    outOfOffice: 4 
  }
];

const sampleGrowthData = [
  { 
    employeeId: 'EMP001', 
    trainingDelivered: 8, 
    trainingAttended: 35, 
    investmentInitiatives: 3, 
    innovation: { ideasSubmitted: 5, ideasImplemented: 3, score: 60 } 
  },
  { 
    employeeId: 'EMP002', 
    trainingDelivered: 5, 
    trainingAttended: 28, 
    investmentInitiatives: 2, 
    innovation: { ideasSubmitted: 3, ideasImplemented: 2, score: 67 } 
  },
  { 
    employeeId: 'EMP003', 
    trainingDelivered: 12, 
    trainingAttended: 40, 
    investmentInitiatives: 5, 
    innovation: { ideasSubmitted: 8, ideasImplemented: 6, score: 75 } 
  },
  { 
    employeeId: 'EMP004', 
    trainingDelivered: 3, 
    trainingAttended: 25, 
    investmentInitiatives: 4, 
    innovation: { ideasSubmitted: 4, ideasImplemented: 2, score: 50 } 
  },
  { 
    employeeId: 'EMP005', 
    trainingDelivered: 6, 
    trainingAttended: 32, 
    investmentInitiatives: 3, 
    innovation: { ideasSubmitted: 6, ideasImplemented: 4, score: 67 } 
  }
];

async function seedPMSSystem() {
  try {
    console.log('🌱 Seeding PMS System Data...');

    // Clear existing data
    console.log('🗑️ Clearing existing PMS data...');
    await Employee.deleteMany({});
    await DeptKPI.deleteMany({});
    await RoleKPI.deleteMany({});
    await DeptTargets.deleteMany({});
    await RoleTargets.deleteMany({});
    await Hygiene.deleteMany({});
    await Growth.deleteMany({});

    // Seed Employees
    console.log('👥 Seeding employees...');
    for (const empData of sampleEmployees) {
      const employee = new Employee(empData);
      await employee.save();
      console.log(`✅ Created employee: ${empData.name}`);
    }

    // Seed Department KPIs
    console.log('📊 Seeding department KPIs...');
    for (const kpiData of sampleDeptKPIs) {
      const kpi = new DeptKPI(kpiData);
      await kpi.save();
      console.log(`✅ Created dept KPI: ${kpiData.name}`);
    }

    // Seed Role KPIs
    console.log('🎯 Seeding role KPIs...');
    for (const kpiData of sampleRoleKPIs) {
      const kpi = new RoleKPI(kpiData);
      await kpi.save();
      console.log(`✅ Created role KPI: ${kpiData.name}`);
    }

    // Seed Department Targets
    console.log('🎯 Seeding department targets...');
    for (const targetData of sampleDeptTargets) {
      const target = new DeptTargets(targetData);
      await target.save();
      console.log(`✅ Created dept target: ${targetData.name}`);
    }

    // Seed Role Targets
    console.log('🎯 Seeding role targets...');
    for (const targetData of sampleRoleTargets) {
      const target = new RoleTargets(targetData);
      await target.save();
      console.log(`✅ Created role target: ${targetData.name}`);
    }

    // Seed Hygiene Data
    console.log('🧼 Seeding hygiene data...');
    for (const hygieneData of sampleHygieneData) {
      const hygiene = new Hygiene(hygieneData);
      await hygiene.save();
      console.log(`✅ Created hygiene data for employee: ${hygieneData.employeeId}`);
    }

    // Seed Growth Data
    console.log('📈 Seeding growth data...');
    for (const growthData of sampleGrowthData) {
      const growth = new Growth(growthData);
      await growth.save();
      console.log(`✅ Created growth data for employee: ${growthData.employeeId}`);
    }

    console.log('🎉 PMS System Data Seeding Completed!');
    console.log('\n📊 Summary:');
    console.log('- Employees:', sampleEmployees.length);
    console.log('- Department KPIs:', sampleDeptKPIs.length);
    console.log('- Role KPIs:', sampleRoleKPIs.length);
    console.log('- Department Targets:', sampleDeptTargets.length);
    console.log('- Role Targets:', sampleRoleTargets.length);
    console.log('- Hygiene Records:', sampleHygieneData.length);
    console.log('- Growth Records:', sampleGrowthData.length);
    console.log('\n🌐 You can now test the PMS system at: http://localhost:5173/pms');

  } catch (error) {
    console.error('❌ Error seeding PMS data:', error.message);
    console.log('🔧 Stack:', error.stack);
  }
}

// Run the seeding function
if (require.main === module) {
  seedPMSSystem();
}

module.exports = { seedPMSSystem };
