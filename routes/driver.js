import express from 'express';
import auth from '../middleware/authentication.js';
import requireRole from '../middleware/requireRole.js';
import { getDriverStats, getDriverProfile, updateOnlineStatus, updateVehicleInfo, getRideHistory, updateDriverProfile } from '../controllers/driver.js';

const router = express.Router();
router.put('/profile', auth, requireRole('driver'), updateDriverProfile);
router.get('/stats', auth, requireRole('driver'), getDriverStats);
router.get('/profile', auth, requireRole('driver'), getDriverProfile);
router.put('/online-status', auth, requireRole('driver'), updateOnlineStatus);
router.put('/vehicle', auth, requireRole('driver'), updateVehicleInfo);
router.get('/rides', auth, requireRole('driver'), getRideHistory);

export default router;
