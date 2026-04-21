const express = require('express');
const router = express.Router();
const { getRoles } = require('../controllers/roleMasterController');

router.get('/', getRoles);

module.exports = router;
