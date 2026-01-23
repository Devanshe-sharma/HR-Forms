const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
    {
        department: String,
        dept_head_email: String,
        dept_group_email: String,
        Id: Number,
        parent_department: String,
        department_type: String
    },
    { collection: 'departments' }
);

module.exports = mongoose.model('Department', DepartmentSchema);
