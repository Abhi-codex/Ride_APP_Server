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

    // Verify JWT token
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    if (payload.type !== 'hospital-staff') {
      throw new UnauthenticatedError("Invalid token type");
    }

    // Find the staff member and populate their hospital info in one efficient query
    const staffMember = await HospitalStaff.findById(payload.id)
      .populate('hospitalId', 'name address')
      .select('+permissions +role +isActive');

    if (!staffMember || !staffMember.isActive) {
      throw new UnauthenticatedError("Account deactivated or not found");
    }

    // Attach comprehensive user info to the request object
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      hospitalId: payload.hospitalId,
      permissions: staffMember.permissions,
      staffMember: staffMember // The full document, including populated hospital
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new UnauthenticatedError("Authentication token is invalid or has expired");
    }
    // Pass other errors (like the ones we throw manually) to the error-handler
    throw error;
  }
};

export default hospitalAuth;