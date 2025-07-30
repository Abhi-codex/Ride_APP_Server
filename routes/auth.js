import express from 'express';
import { refreshToken, auth, updateProfile, getProfile, sendOtp, verifyOtp } from '../controllers/auth.js';
import authMiddleware from '../middleware/authentication.js';

const router = express.Router();

router.post('/refresh-token', refreshToken);
router.post('/signin', auth);
router.put('/profile', authMiddleware, updateProfile);
router.get('/profile', authMiddleware, getProfile);

// Restrict OTP endpoints to doctors only
router.post('/send-otp', (req, res, next) => {
  if (req.body.role && req.body.role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'OTP endpoints are for doctors only.' });
  }
  next();
}, sendOtp);

router.post('/verify-otp', (req, res, next) => {
  if (req.body.role && req.body.role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'OTP endpoints are for doctors only.' });
  }
  next();
}, verifyOtp);

export default router;
