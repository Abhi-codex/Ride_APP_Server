import HospitalStaff from "../models/HospitalStaff.js";
import { UnauthenticatedError } from "../errors/index.js";

const requireHospitalStaff = (requiredPermission = null) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        throw new UnauthenticatedError("Authentication required");
      }

      // Find hospital staff member
      const staffMember = await HospitalStaff.findOne({ 
        user: req.user.userId,
        isActive: true 
      }).populate('hospitalId');

      if (!staffMember) {
        throw new UnauthenticatedError("Hospital staff access required");
      }

      // Check specific permission if required
      if (requiredPermission && !staffMember.permissions[requiredPermission]) {
        throw new UnauthenticatedError(`Permission denied: ${requiredPermission} required`);
      }

      // Attach staff member to request
      req.hospitalStaff = staffMember;
      next();
    } catch (error) {
      throw new UnauthenticatedError("Hospital staff authentication failed");
    }
  };
};

export default requireHospitalStaff;
