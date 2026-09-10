const express = require('express');
const router = express.Router();
const {
  getCategories, createCategory, updateCategory, deleteCategory, toggleCategoryStatus,
} = require('../controllers/categoryController');
const { authenticate, authorize } = require('../middleware/auth');
const { optionalAuthenticate } = require('../middleware/optionalAuth');

router.get('/', optionalAuthenticate, getCategories);
router.post('/', authenticate, authorize('admin'), createCategory);
router.put('/:id', authenticate, authorize('admin'), updateCategory);
router.patch('/:id/status', authenticate, authorize('admin'), toggleCategoryStatus);
router.delete('/:id', authenticate, authorize('admin'), deleteCategory);

module.exports = router;
