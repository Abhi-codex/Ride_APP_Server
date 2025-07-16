import express from 'express';
import auth from '../middleware/authentication.js';
import { getDriverStats, getDriverProfile, updateOnlineStatus, updateVehicleInfo, getRideHistory } from '../controllers/driver.js';

const router = express.Router();

router.get('/stats', auth, getDriverStats);
router.get('/profile', auth, getDriverProfile);
router.put('/online-status', auth, updateOnlineStatus);
router.put('/vehicle', auth, updateVehicleInfo);
router.get('/rides', auth, getRideHistory);

export default router;
