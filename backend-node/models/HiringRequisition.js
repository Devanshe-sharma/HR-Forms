const mongoose = require('mongoose');

const HiringReqSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    designationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // add any other form fields here
}, { timestamps: true });

module.exports = mongoose.model('HiringRequisition', HiringReqSchema);
