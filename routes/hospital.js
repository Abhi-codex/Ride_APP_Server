import express from "express";
import {
  searchHospitals,
  getHospitalDetails,
  createHospital,
  getHospitals,
  getHospitalPhoto
} from "../controllers/hospital.js";
import auth from "../middleware/authentication.js";

const router = express.Router();

// Search hospitals using Google Places API
router.get("/search", searchHospitals);

// Get hospital details by place ID
router.get("/details/:placeId", getHospitalDetails);

// Get hospital photo by photo reference
router.get("/photo/:photoReference", getHospitalPhoto);

// Create hospital in local database (authenticated)
router.post("/", auth, createHospital);

// Get hospitals from local database
router.get("/", getHospitals);

export default router;
