const mongoose = require('mongoose');

const DesignationSchema = new mongoose.Schema(
    {
        model: String,
        fields: Object,
    },
    { collection: 'designations' }
);

module.exports = mongoose.model('Designation', DesignationSchema);
