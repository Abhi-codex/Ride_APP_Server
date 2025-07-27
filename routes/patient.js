import express from 'express';
import auth from '../middleware/authentication.js';
import requireRole from '../middleware/requireRole.js';
import { getPatientProfile, updatePatientProfile, getPatientAppointments } from '../controllers/patient.js';

const router = express.Router();

router.get('/profile', auth, requireRole('patient'), getPatientProfile);
router.put('/profile', auth, requireRole('patient'), updatePatientProfile);
router.get('/appointments', auth, requireRole('patient'), getPatientAppointments);

export default router;
