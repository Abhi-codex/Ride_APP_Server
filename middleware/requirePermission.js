import { UnauthenticatedError } from "../errors/index.js";

/**
 * @param {string} permission - Required permission key
 * @returns {Function} Express middleware function
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.permissions) {
        throw new UnauthenticatedError("Authentication required");
      }

      if (!req.user.permissions[permission]) {
        throw new UnauthenticatedError(`Insufficient permissions: ${permission} required`);
      }

      next();
    } catch (error) {
      throw error;
    }
  };
};

/**
 * @param {string[]} permissions - Array of permission keys
 * @returns {Function} Express middleware function
 */
export const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.permissions) {
        throw new UnauthenticatedError("Authentication required");
      }

      const hasPermission = permissions.some(permission => 
        req.user.permissions[permission]
      );

      if (!hasPermission) {
        throw new UnauthenticatedError(`Insufficient permissions: One of [${permissions.join(', ')}] required`);
      }

      next();
    } catch (error) {
      throw error;
    }
  };
};

/**
 * @returns {Function} Express middleware function
 */
export const requireAdminRole = () => {
  return (req, res, next) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        throw new UnauthenticatedError("Admin role required");
      }
      next();
    } catch (error) {
      throw error;
    }
  };
};

export default { requirePermission, requireAnyPermission, requireAdminRole };
