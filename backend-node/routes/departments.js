const express = require('express');
const router = express.Router();
const department = require('../models/Department');

router.get('/', async (req, res) => {
    const departments = await department.find();

    res.json(departments.map(d => ({
        data: departments
    })));
});

module.exports = router;
