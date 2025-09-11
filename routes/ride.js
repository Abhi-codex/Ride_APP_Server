import express from "express";
import auth from '../middleware/authentication.js';
import requireRole from '../middleware/requireRole.js';
import { createRide, updateRideStatus, acceptRide, getMyRides, getAvailableRides, rateRide, verifyPickup } from "../controllers/ride.js";

const router = express.Router();

router.use((req, res, next) => {
  req.io = req.app.get("io");
  next();
});

router.post("/create", auth, createRide);
router.patch("/accept/:rideId", auth, requireRole('driver'), acceptRide);
router.patch("/update/:rideId", auth, updateRideStatus);
router.get("/rides", auth, getMyRides);
router.get("/driverrides", auth, requireRole('driver'), getAvailableRides);
router.patch("/rate/:rideId", auth, rateRide);
router.post("/verify-pickup", auth, requireRole('driver'), verifyPickup);

export default router;
