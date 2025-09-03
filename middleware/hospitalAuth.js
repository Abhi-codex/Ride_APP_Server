import jwt from "jsonwebtoken";
import { UnauthenticatedError } from "../errors/index.js";
import HospitalStaff from "../models/HospitalStaff.js";

const hospitalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthenticatedError("Authentication token required");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new UnauthenticatedError("Authentication token required");
    }

    // Verify JWT token with consistent secret
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Additional validation for hospital staff
    if (payload.type !== 'hospital-staff') {
      throw new UnauthenticatedError("Invalid token type");
    }

    // Verify staff member still exists and is active
    const staffMember = await HospitalStaff.findById(payload.id)
      .populate('hospitalId', 'name address')
      .select('+permissions +role +isActive');

    if (!staffMember || !staffMember.isActive) {
      throw new UnauthenticatedError("Account deactivated or not found");
    }

    // Attach comprehensive user info to request
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      hospitalId: payload.hospitalId,
      permissions: staffMember.permissions,
      staffMember: staffMember
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthenticatedError("Invalid authentication token");
    }
    if (error.name === 'TokenExpiredError') {
      throw new UnauthenticatedError("Authentication token expired");
    }
    throw error;
  }
};

export default hospitalAuth;
