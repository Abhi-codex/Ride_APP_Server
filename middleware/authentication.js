import jwt from "jsonwebtoken";
import process from "process";
import User from "../models/User.js";
import NotFoundError from "../errors/not-found.js";
import UnauthenticatedError from "../errors/unauthenticated.js";

// JWT-based authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthenticatedError("No valid authorization header provided");
    }

    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    // Find user in database
    const user = await User.findById(payload.id);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    
    if (!user.isActive) {
      throw new UnauthenticatedError("User account is deactivated");
    }

    // Add user info to request
    req.user = {
      id: user._id,
      phone: user.phone,
      role: user.role,
      email: user.email,
      name: user.name,
      profileCompleted: user.profileCompleted,
      phoneVerified: user.phoneVerified
    };

    // Keep socket.io attachment for backward compatibility
    req.socket = req.io;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthenticatedError("Invalid token");
    } else if (error.name === 'TokenExpiredError') {
      throw new UnauthenticatedError("Token expired");
    } else {
      console.error("Authentication error:", error);
      throw new UnauthenticatedError("Authentication failed");
    }
  }
};

export default authMiddleware;
