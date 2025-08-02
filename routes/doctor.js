import express from 'express';
import { authenticateJWT } from '../controllers/auth.js';
import requireRole from '../middleware/requireRole.js';
import { 
  getDoctorProfile, 
  updateDoctorProfile, 
  getAvailableSlots, 
  setAvailableSlots, 
  getDoctorAppointments,
  getDoctorHolidays,
  setDoctorHolidays,
  getPublicDoctorAvailability,
  generateRecurringSlots
} from '../controllers/doctor.js';

const router = express.Router();

// Public route for patients to view doctor availability
router.get('/:doctorId/availability', getPublicDoctorAvailability);

// All routes below require JWT authentication and doctor role
router.get('/profile', authenticateJWT, requireRole('doctor'), getDoctorProfile);
router.put('/profile', authenticateJWT, requireRole('doctor'), updateDoctorProfile);
router.get('/slots', authenticateJWT, requireRole('doctor'), getAvailableSlots);
router.put('/slots', authenticateJWT, requireRole('doctor'), setAvailableSlots);
router.post('/slots/recurring', authenticateJWT, requireRole('doctor'), generateRecurringSlots);
router.get('/holidays', authenticateJWT, requireRole('doctor'), getDoctorHolidays);
router.put('/holidays', authenticateJWT, requireRole('doctor'), setDoctorHolidays);
router.get('/appointments', authenticateJWT, requireRole('doctor'), getDoctorAppointments);

export default router;
