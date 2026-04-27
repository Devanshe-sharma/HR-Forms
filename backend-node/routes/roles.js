const express = require('express');
const router = express.Router();

const controller = require('../controllers/roleMasterController');
console.log('controller:', controller);

const getRoles = controller.getRoles;

if (typeof getRoles !== 'function') {
  throw new Error(
    `roleMasterController does not export getRoles. Exported keys: ${Object.keys(controller).join(', ')}`
  );
}

// GET /api/roles
router.get('/', getRoles);

module.exports = router;