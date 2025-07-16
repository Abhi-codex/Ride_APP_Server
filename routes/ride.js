import express from "express";
import { createRide, updateRideStatus, acceptRide, getMyRides, getAvailableRides, rateRide } from "../controllers/ride.js";

const router = express.Router();

router.use((req, res, next) => {
  req.io = req.app.get("io");
  next();
});

router.post("/create", createRide);
router.patch("/accept/:rideId", acceptRide);
router.patch("/update/:rideId", updateRideStatus);
router.get("/rides", getMyRides);
router.get("/driverrides", getAvailableRides);
router.patch("/rate/:rideId", rateRide);

export default router;
