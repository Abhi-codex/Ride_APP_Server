import jwt from "jsonwebtoken";
import process from "process";
import User from "../models/User.js";
import NotFoundError from "../errors/not-found.js";
import UnauthenticatedError from "../errors/unauthenticated.js";
import { firebaseAuth, getFirebaseUser, firebaseAdmin } from "../config/firebase.js";

// New Firebase-based authentication middleware
const firebaseAuthMiddleware = async (req, res, next) => {
  try {
    // Use Firebase's middleware first
    await new Promise((resolve, reject) => {
      firebaseAuth(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Get Firebase user info
    const firebaseUser = getFirebaseUser(req);
    if (!firebaseUser || !firebaseUser.uid) {
      throw new UnauthenticatedError("Authentication invalid");
    }

    // Find user in our database using Firebase UID
    const user = await User.findOne({ firebaseUid: firebaseUser.uid });
    if (!user) {
      throw new NotFoundError("User not found in our system");
    }

    // Add user info to request
    req.user = {
      id: user._id,
      firebaseUid: user.firebaseUid,
      phone: user.phone,
      role: user.role,
      email: user.email,
      name: user.name,
      profileCompleted: user.profileCompleted,
      onboardingStep: user.onboardingStep
    };

    // Keep socket.io attachment for backward compatibility
    req.socket = req.io;

    next();
  } catch (error) {
    console.error("Firebase authentication error:", error);
    throw new UnauthenticatedError("Authentication invalid");
  }
};

// Legacy JWT-based authentication (keep for backward compatibility during migration)
const legacyAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    throw new UnauthenticatedError("Authentication invalid");
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = { id: payload.id, phone: payload.phone };
    req.socket = req.io;

    const user = await User.findById(payload.id);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Add role to req.user for proper authorization
    req.user.role = user.role;

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    throw new UnauthenticatedError("Authentication invalid");
  }
};

// Combined auth middleware that tries Firebase first, then falls back to legacy
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    throw new UnauthenticatedError("Authentication invalid");
  }

  const token = authHeader.split(" ")[1];
  
  // Check if it's a Firebase token (Firebase tokens are longer and have specific format)
  // Firebase tokens are typically much longer than JWT tokens
  if (token && token.length > 100) {
    try {
      await firebaseAuthMiddleware(req, res, next);
      return;
    } catch (error) {
      // If Firebase auth fails, try legacy auth as fallback
      console.log("Firebase auth failed, trying legacy auth:", error.message);
    }
  }

  // Fallback to legacy JWT auth
  await legacyAuth(req, res, next);
};

export default auth;
export { firebaseAuthMiddleware, legacyAuth };
