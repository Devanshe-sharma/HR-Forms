const mongoose = require('mongoose');

const DesignationSchema = new mongoose.Schema(
    {
        
        department: String,
        designation: String,
        role_document_link: String,
        jd_link: Number,
        remarks: String,
        role_document: String
    },
    { collection: 'designations' }
);

module.exports = mongoose.model('Designation', DesignationSchema);
