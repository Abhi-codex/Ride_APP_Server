import express from 'express';
import authMiddleware from '../middleware/authentication.js';
import requireRole from '../middleware/requireRole.js';
import { getDoctorProfile, updateDoctorProfile, getAvailableSlots, setAvailableSlots, getDoctorAppointments } from '../controllers/doctor.js';

const router = express.Router();

// All routes require authentication and doctor role (add doctor role check in middleware or controller)
router.get('/profile', authMiddleware, requireRole('doctor'), getDoctorProfile);
router.put('/profile', authMiddleware, requireRole('doctor'), updateDoctorProfile);
router.get('/slots', authMiddleware, requireRole('doctor'), getAvailableSlots);
router.put('/slots', authMiddleware, requireRole('doctor'), setAvailableSlots);
router.get('/appointments', authMiddleware, requireRole('doctor'), getDoctorAppointments);

export default router;
