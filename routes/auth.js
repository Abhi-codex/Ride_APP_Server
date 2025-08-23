import express from 'express';
import { 
  sendOTP, 
  verifyOTP, 
  refreshToken, 
  updateProfile, 
  getProfile 
} from '../controllers/auth.js';
import authMiddleware from '../middleware/authentication.js';

const router = express.Router();

// OTP-based authentication
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

// Token management
router.post('/refresh-token', refreshToken);

// Profile management
router.put('/profile', authMiddleware, updateProfile);
router.get('/profile', authMiddleware, getProfile);

export default router;
