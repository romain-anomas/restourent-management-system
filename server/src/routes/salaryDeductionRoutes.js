const express = require('express');
const router = express.Router();
const { listSalaryDeductions, reviewSalaryDeduction } = require('../controllers/salaryDeductionController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/', listSalaryDeductions);
router.put('/:id/review', reviewSalaryDeduction);

module.exports = router;
