import express from 'express';
import { refreshToken, updateProfile, getProfile } from '../controllers/auth.js';
import authMiddleware from '../middleware/authentication.js';

const router = express.Router();

router.post('/refresh-token', refreshToken);
router.put('/profile', authMiddleware, updateProfile);
router.get('/profile', authMiddleware, getProfile);

export default router;
