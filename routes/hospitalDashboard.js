import express from "express";
import {
  hospitalStaffLogin,
  getHospitalDashboard,
  getHospitalRides,
  getHospitalDrivers,
  getHospitalAnalytics,
  updateHospitalInfo,
  createHospitalStaff,
  debugAuth,
  getIncomingPatients,
  getLiveAmbulanceTracking,
  getAmbulanceStatus,
  getEmergencyContacts,
  updateBedAvailability,
  getBedAvailability,
  updateAmbulanceLocation
} from "../controllers/hospitalDashboard.js";
import hospitalAuth from "../middleware/hospitalAuth.js";

const router = express.Router();

// Public routes
router.post("/staff/login", hospitalStaffLogin);
router.post("/staff/create", createHospitalStaff);

// Protected routes (require hospital JWT authentication)
router.get("/debug", hospitalAuth, debugAuth);
router.get("/dashboard", hospitalAuth, getHospitalDashboard);
router.get("/rides", hospitalAuth, getHospitalRides);
router.get("/drivers", hospitalAuth, getHospitalDrivers);
router.get("/analytics", hospitalAuth, getHospitalAnalytics);
router.patch("/info", hospitalAuth, updateHospitalInfo);

// 📌 InstaAid Hospital Panel - Main Features
// 1. Incoming Patient Details
router.get("/incoming-patients", hospitalAuth, getIncomingPatients);

// 2. Ambulance Tracking (Live Map Data)
router.get("/live-tracking", hospitalAuth, getLiveAmbulanceTracking);

// 3. Ambulance Status Overview
router.get("/ambulance-status", hospitalAuth, getAmbulanceStatus);

// 4. Emergency Contact Information
router.get("/emergency-contacts", hospitalAuth, getEmergencyContacts);
router.get("/emergency-contacts/:rideId", hospitalAuth, getEmergencyContacts);

// 5. Bed Availability Management
router.get("/bed-availability", hospitalAuth, getBedAvailability);
router.put("/bed-availability", hospitalAuth, updateBedAvailability);

// Location tracking endpoint (for driver apps to update location)
router.put("/ambulance/:rideId/location", updateAmbulanceLocation);

export default router;
