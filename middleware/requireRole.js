import User from "../models/User.js";
import UnauthenticatedError from "../errors/unauthenticated.js";

const requireRole = (role) => async (req, res, next) => {
  try {
    // req.user is set by authentication middleware
    const user = await User.findById(req.user.id);
    if (!user || user.role !== role) {
      throw new UnauthenticatedError(`Access denied: ${role} role required`);
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default requireRole;

// Middleware to require a specific user role (e.g., doctor, patient, driver)