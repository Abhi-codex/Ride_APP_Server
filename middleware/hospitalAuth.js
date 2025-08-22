import jwt from "jsonwebtoken";
import { UnauthenticatedError } from "../errors/index.js";

const hospitalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthenticatedError("Authentication invalid");
  }

  const token = authHeader.split(" ")[1];

  try {
    // Only verify JWT tokens for hospital staff
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to request
    req.user = { 
      id: payload.userId || payload.id,
      userId: payload.userId || payload.id,
      name: payload.name,
      role: payload.role 
    };
    
    next();
  } catch (error) {
    console.error("Hospital JWT auth error:", error.message);
    throw new UnauthenticatedError("Authentication invalid");
  }
};

export default hospitalAuth;
