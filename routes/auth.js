import express from 'express';
import { refreshToken, auth, updateProfile, getProfile } from '../controllers/auth.js';
import authMiddleware from '../middleware/authentication.js';

const router = express.Router();

router.post('/refresh-token', refreshToken);
router.post('/signin', auth);
router.put('/profile', authMiddleware, updateProfile);
router.get('/profile', authMiddleware, getProfile);

export default router;
