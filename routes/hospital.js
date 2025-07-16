import express from "express";
import { searchHospitals, getHospitalDetails, createHospital, getHospitals, getHospitalPhoto } from "../controllers/hospital.js";
import auth from "../middleware/authentication.js";

const router = express.Router();

router.get("/search", searchHospitals);
router.get("/details/:placeId", getHospitalDetails);
router.get("/photo/:photoReference", getHospitalPhoto);
router.post("/", auth, createHospital);
router.get("/", getHospitals);

export default router;
