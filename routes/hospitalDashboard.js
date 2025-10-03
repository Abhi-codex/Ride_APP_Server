import express from "express";
import rateLimit from "express-rate-limit";
import {
  hospitalStaffLogin, getHospitalDashboard, getHospitalRides, getHospitalDrivers, getHospitalAnalytics,
  updateHospitalInfo, createHospitalStaff, debugAuth, getIncomingPatients, getLiveAmbulanceTracking,
  getAmbulanceStatus, getEmergencyContacts, updateBedAvailability, getBedAvailability, updateAmbulanceLocation,
  getMyInfo // <-- This is the function we are adding to the list
} from "../controllers/hospitalDashboard.js";
import hospitalAuth from "../middleware/hospitalAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { validateRequest, validationSchemas, sanitizeInput } from "../middleware/validation.js";

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window per IP
  message: {
    success: false,
    error: "Too many login attempts. Please try again in 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    success: false,
    error: "Too many requests. Please slow down."
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.use(apiLimiter);
router.use(sanitizeInput);

// Public routes (with stricter rate limiting)
router.post("/staff/login", authLimiter, validateRequest(validationSchemas.login), hospitalStaffLogin);
router.post("/staff/create", authLimiter, validateRequest(validationSchemas.createStaff), createHospitalStaff);

// Protected routes (require hospital JWT authentication)
router.get("/debug", hospitalAuth, debugAuth);
router.get("/dashboard", hospitalAuth,  requirePermission('viewDashboard'), getHospitalDashboard);
router.get("/rides", hospitalAuth, requirePermission('viewRides'), getHospitalRides);
router.get("/drivers", hospitalAuth, requirePermission('viewDashboard'), getHospitalDrivers);
router.get("/analytics", hospitalAuth, requirePermission('viewAnalytics'), getHospitalAnalytics);
router.patch("/info", hospitalAuth, requirePermission('manageHospitalInfo'), updateHospitalInfo);

// 1. Incoming Patient Details
router.get("/incoming-patients", hospitalAuth, requirePermission('viewRides'), getIncomingPatients);

// 2. Ambulance Tracking (Live Map Data)
router.get("/live-tracking", hospitalAuth, requirePermission('viewDashboard'), getLiveAmbulanceTracking);

// 3. Ambulance Status Overview
router.get("/ambulance-status", hospitalAuth, requirePermission('viewDashboard'), getAmbulanceStatus);

// 4. Emergency Contact Information
router.get("/emergency-contacts", hospitalAuth, requirePermission('viewRides'), getEmergencyContacts);
router.get("/emergency-contacts/:rideId", hospitalAuth, requirePermission('viewRides'), getEmergencyContacts);

// 5. Bed Availability Management
router.get("/bed-availability", hospitalAuth, requirePermission('viewDashboard'), getBedAvailability);
router.put("/bed-availability", hospitalAuth, requirePermission('manageHospitalInfo'), validateRequest(validationSchemas.bedUpdate), updateBedAvailability);

// Location tracking endpoint (for driver apps to update location)
router.put("/ambulance/:rideId/location", validateRequest(validationSchemas.locationUpdate), updateAmbulanceLocation);
router.get("/staff/me", hospitalAuth, getMyInfo);
// Error handling middleware
router.use((error, req, res, next) => {
  console.error(`Hospital Dashboard API Error: ${error.message}`);
  
  // Don't leak internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.statusCode || 500).json({
    success: false,
    error: isDevelopment ? error.message : "An internal error occurred",
    ...(isDevelopment && { stack: error.stack })
  });
});

export default router;
