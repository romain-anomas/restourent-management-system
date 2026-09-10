const express = require('express');
const router = express.Router();
const {
  getProducts, getLowStockProducts, getProductById,
  createProduct, updateProduct, deleteProduct, toggleProductStatus,
} = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { optionalAuthenticate } = require('../middleware/optionalAuth');
const { handleProductImageUpload } = require('../middleware/upload');

router.get('/', optionalAuthenticate, getProducts);
router.get('/low-stock', authenticate, authorize('admin'), getLowStockProducts);
router.get('/:id', optionalAuthenticate, getProductById);

router.post('/', authenticate, authorize('admin'), handleProductImageUpload, createProduct);
router.put('/:id', authenticate, authorize('admin'), handleProductImageUpload, updateProduct);
router.patch('/:id/status', authenticate, authorize('admin'), toggleProductStatus);
router.delete('/:id', authenticate, authorize('admin'), deleteProduct);

module.exports = router;
