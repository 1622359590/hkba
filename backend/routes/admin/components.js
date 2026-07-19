const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const { requirePermission } = require('../../middleware/requirePermission');
const { requestContext } = require('../../lib/respond');
const { listDefinitions } = require('../../components/registry');

router.use(requestContext);

// GET /api/admin/components/definitions (spec: data-api §5)
router.get('/definitions', authMiddleware, requirePermission('content.read'), (req, res) => {
  res.ok({ definitions: listDefinitions() });
});

module.exports = router;
