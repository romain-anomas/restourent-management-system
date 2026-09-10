const express = require('express');
const router = express.Router();
const {
  listWorkers, getWorkerById, createWorker, updateWorker, toggleWorkerStatus, resetWorkerPassword,
} = require('../controllers/workerController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/', listWorkers);
router.get('/:id', getWorkerById);
router.post('/', createWorker);
router.put('/:id', updateWorker);
router.patch('/:id/status', toggleWorkerStatus);
router.post('/:id/reset-password', resetWorkerPassword);

module.exports = router;
