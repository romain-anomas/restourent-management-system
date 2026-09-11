const express = require('express');
const router = express.Router();
const { listExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/', listExpenses);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
