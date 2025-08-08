import express from 'express';
import User from '../models/User.js';
import { StatusCodes } from "http-status-codes";
import { BadRequestError } from "../errors/index.js";
import { firebaseAdmin } from '../config/firebase.js';

const router = express.Router();

// Firebase phone verification endpoint
router.post('/verify-firebase-token', async (req, res) => {
  try {
    console.log('🔥 Firebase token verification request received');
    
    const { idToken, role } = req.body;
    
    if (!idToken) {
      throw new BadRequestError("Firebase ID token is required");
    }
    
    if (!role || !["patient", "driver", "doctor"].includes(role)) {
      throw new BadRequestError("Valid role is required (patient, driver, or doctor)");
    }

    // Check if Firebase is initialized
    if (!firebaseAdmin.apps || firebaseAdmin.apps.length === 0) {
      console.error('❌ Firebase not initialized');
      throw new Error('Firebase Admin SDK not initialized');
    }

    console.log('🔥 Verifying Firebase ID token...');
    
    // Verify Firebase ID token
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    
    console.log('🔥 FIREBASE TOKEN VERIFIED 🔥');
    console.log(`🆔 Firebase UID: ${decodedToken.uid}`);
    console.log(`📱 Phone: ${decodedToken.phone_number}`);
    console.log(`📧 Email: ${decodedToken.email}`);
    console.log(`👤 Role: ${role}`);
    console.log('==========================================');

    // Check if user already exists
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Create new user
      user = new User({
        firebaseUid: decodedToken.uid,
        phone: decodedToken.phone_number,
        email: decodedToken.email,
        name: decodedToken.name,
        role,
        phoneVerified: !!decodedToken.phone_number,
        authMethods: []
      });

      // Add auth methods based on available data
      if (decodedToken.phone_number) {
        user.authMethods.push({
          type: 'phone',
          identifier: decodedToken.phone_number,
          verified: true
        });
      }
      
      if (decodedToken.email) {
        user.authMethods.push({
          type: 'email',
          identifier: decodedToken.email,
          verified: decodedToken.email_verified || false
        });
      }

      // Check for Google OAuth
      if (decodedToken.firebase && decodedToken.firebase.sign_in_provider === 'google.com') {
        user.authMethods.push({
          type: 'google',
          identifier: decodedToken.email,
          verified: true
        });
      }

      await user.save();

      // Create role-specific profiles
      if (role === "doctor") {
        const Doctor = (await import("../models/Doctor.js")).default;
        await Doctor.create({ 
          user: user._id, 
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          specialties: [], 
          bio: "", 
          availableSlots: [] 
        });
      } else if (role === "patient") {
        const Patient = (await import("../models/Patient.js")).default;
        await Patient.create({ user: user._id });
      } else if (role === "driver") {
        const Driver = (await import("../models/Driver.js")).default;
        await Driver.create({
          user: user._id,
          isOnline: false
        });
      }

      console.log('✅ USER CREATED SUCCESSFULLY ✅');
      console.log(`👤 User ID: ${user._id}`);
      console.log(`🆔 Firebase UID: ${user.firebaseUid}`);
      console.log(`👤 Role: ${user.role}`);
      console.log('==========================================');
    } else {
      console.log('✅ USER ALREADY EXISTS ✅');
      console.log(`👤 User ID: ${user._id}`);
      console.log(`🆔 Firebase UID: ${user.firebaseUid}`);
      console.log(`👤 Role: ${user.role}`);
      console.log('==========================================');
    }

    // Generate custom JWT tokens for our app
    console.log('🔑 Generating custom JWT tokens...');
    
    try {
      const accessToken = user.createAccessToken();
      const refreshToken = user.createRefreshToken();
      
      console.log('✅ JWT tokens generated successfully');
      console.log(`📝 Access token length: ${accessToken ? accessToken.length : 'null'}`);
      console.log(`📝 Refresh token length: ${refreshToken ? refreshToken.length : 'null'}`);

      res.status(StatusCodes.OK).json({
        success: true,
        message: "Firebase authentication successful",
        user: {
          id: user._id,
          firebaseUid: user.firebaseUid,
          phone: user.phone,
          email: user.email,
          name: user.name,
          role: user.role,
          phoneVerified: user.phoneVerified,
          profileCompleted: user.profileCompleted,
          onboardingStep: user.onboardingStep
        },
        tokens: {
          accessToken,
          refreshToken
        },
        tokenInfo: {
          accessTokenType: 'Bearer',
          accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY,
          refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY
        }
      });
      
    } catch (tokenError) {
      console.error('❌ JWT token generation failed:', tokenError);
      throw new Error(`Token generation failed: ${tokenError.message}`);
    }

  } catch (error) {
    console.error('❌ Firebase authentication error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Firebase authentication failed",
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get Firebase user info (for debugging)
router.get('/firebase-user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    if (!uid) {
      throw new BadRequestError("Firebase UID is required");
    }

    // Get user from Firebase
    const firebaseUser = await firebaseAdmin.auth().getUser(uid);
    
    // Get user from our database
    const dbUser = await User.findOne({ firebaseUid: uid });

    res.status(StatusCodes.OK).json({
      firebaseUser: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        phone: firebaseUser.phoneNumber,
        emailVerified: firebaseUser.emailVerified,
        disabled: firebaseUser.disabled,
        metadata: firebaseUser.metadata
      },
      dbUser: dbUser ? {
        id: dbUser._id,
        role: dbUser.role,
        name: dbUser.name,
        profileCompleted: dbUser.profileCompleted
      } : null
    });

  } catch (error) {
    console.error('Error getting Firebase user:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message || "Failed to get Firebase user"
    });
  }
});

export default router;
