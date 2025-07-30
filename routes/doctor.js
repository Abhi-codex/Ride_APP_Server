import express from 'express';
import { authenticateJWT } from '../controllers/auth.js';
import requireRole from '../middleware/requireRole.js';
import { getDoctorProfile, updateDoctorProfile, getAvailableSlots, setAvailableSlots, getDoctorAppointments } from '../controllers/doctor.js';

const router = express.Router();

// All routes require JWT authentication and doctor role
router.get('/profile', authenticateJWT, requireRole('doctor'), getDoctorProfile);
router.put('/profile', authenticateJWT, requireRole('doctor'), updateDoctorProfile);
router.get('/slots', authenticateJWT, requireRole('doctor'), getAvailableSlots);
router.put('/slots', authenticateJWT, requireRole('doctor'), setAvailableSlots);
router.get('/appointments', authenticateJWT, requireRole('doctor'), getDoctorAppointments);

export default router;
