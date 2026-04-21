require('dotenv').config();

const mongoose = require('mongoose');
const RoleMaster = require('../models/role_master');
const { ROLE_MASTER_COLLECTION } = require('../models/role_master');

function normalizeString(value) {
  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function normalizeDepartmentType(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return '';
  }

  const lowered = normalized.toLowerCase();
  if (lowered === 'delivery') {
    return 'Delivery';
  }

  if (lowered === 'support') {
    return 'Support';
  }

  return '';
}

function buildDepartmentLookupKey(departmentDoc) {
  const deptId = normalizeString(
    departmentDoc.dept_id ??
    departmentDoc.Id ??
    departmentDoc.id
  );

  if (deptId) {
    return `dept_id:${deptId}`;
  }

  const department = normalizeString(departmentDoc.department).toLowerCase();
  return department ? `department:${department}` : '';
}

function buildDesignationLookupKey(designationDoc) {
  const deptId = normalizeString(designationDoc.dept_id ?? designationDoc.Id ?? designationDoc.id);
  if (deptId) {
    return `dept_id:${deptId}`;
  }

  const department = normalizeString(designationDoc.department).toLowerCase();
  return department ? `department:${department}` : '';
}

function mapDepartmentDoc(doc) {
  return {
    dept_id: normalizeString(doc.dept_id ?? doc.Id ?? doc.id),
    department: normalizeString(doc.department),
    dept_page_link: normalizeString(doc.dept_page_link),
    dept_head_email: normalizeString(doc.dept_head_email),
    dept_group_email: normalizeString(doc.dept_group_email),
    parent_department: normalizeString(doc.parent_department),
    department_type: normalizeDepartmentType(doc.department_type),
    department_head: normalizeString(doc.department_head),
    department_deputy: normalizeString(doc.department_deputy),
  };
}

function mapDesignationDoc(doc, departmentData = {}) {
  return {
    ...departmentData,
    dept_id: normalizeString(doc.dept_id ?? departmentData.dept_id),
    department: normalizeString(doc.department ?? departmentData.department),
    desig_id: normalizeString(doc.desig_id ?? doc.Id ?? doc.id ?? doc._id),
    designation: normalizeString(doc.designation),
    role_document_link: normalizeString(doc.role_document_link ?? doc.role_document),
    jd_link: normalizeString(doc.jd_link),
    remarks: normalizeString(doc.remarks),
    management_level: normalizeString(doc.management_level),
    reporting_manager: normalizeString(doc.reporting_manager),
  };
}

async function migrateRoleMaster() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not configured');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const db = mongoose.connection.db;
  const [departments, designations] = await Promise.all([
    db.collection('departments').find({}).toArray(),
    db.collection('designations').find({}).toArray(),
  ]);

  const departmentMap = new Map();
  for (const departmentDoc of departments) {
    const key = buildDepartmentLookupKey(departmentDoc);
    if (key) {
      departmentMap.set(key, mapDepartmentDoc(departmentDoc));
    }
  }

  const unmatchedDesignations = [];
  const bulkOperations = [];
  const seenPairs = new Set();

  for (const designationDoc of designations) {
    const lookupKey = buildDesignationLookupKey(designationDoc);
    const matchingDepartment = lookupKey ? departmentMap.get(lookupKey) : null;

    if (!matchingDepartment) {
      unmatchedDesignations.push({
        designation: normalizeString(designationDoc.designation),
        department: normalizeString(designationDoc.department),
        desig_id: normalizeString(designationDoc.desig_id ?? designationDoc.Id ?? designationDoc.id ?? designationDoc._id),
      });
    }

    const roleRecord = mapDesignationDoc(designationDoc, matchingDepartment || {});
    const uniquenessKey = `${roleRecord.dept_id}::${roleRecord.desig_id}`;

    if (!roleRecord.dept_id || !roleRecord.desig_id || seenPairs.has(uniquenessKey)) {
      continue;
    }

    seenPairs.add(uniquenessKey);
    bulkOperations.push({
      updateOne: {
        filter: {
          dept_id: roleRecord.dept_id,
          desig_id: roleRecord.desig_id,
        },
        update: { $set: roleRecord },
        upsert: true,
      },
    });
  }

  const matchedDepartmentKeys = new Set(
    designations
      .map(buildDesignationLookupKey)
      .filter((key) => key && departmentMap.has(key))
  );

  const unmatchedDepartments = departments
    .filter((departmentDoc) => {
      const key = buildDepartmentLookupKey(departmentDoc);
      return key && !matchedDepartmentKeys.has(key);
    })
    .map((departmentDoc) => ({
      dept_id: normalizeString(departmentDoc.dept_id ?? departmentDoc.Id ?? departmentDoc.id),
      department: normalizeString(departmentDoc.department),
    }));

  if (bulkOperations.length) {
    await RoleMaster.bulkWrite(bulkOperations, { ordered: false });
  }

  console.log('RoleMaster migration completed.');
  console.log(`Target collection: ${ROLE_MASTER_COLLECTION}`);
  console.log(`Departments scanned: ${departments.length}`);
  console.log(`Designations scanned: ${designations.length}`);
  console.log(`RoleMaster upserts prepared: ${bulkOperations.length}`);
  console.log(`Unmatched departments: ${unmatchedDepartments.length}`);
  if (unmatchedDepartments.length) {
    console.log(JSON.stringify(unmatchedDepartments, null, 2));
  }

  console.log(`Unmatched designations: ${unmatchedDesignations.length}`);
  if (unmatchedDesignations.length) {
    console.log(JSON.stringify(unmatchedDesignations, null, 2));
  }
}

migrateRoleMaster()
  .catch((error) => {
    console.error('RoleMaster migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
