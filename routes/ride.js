import express from "express";
import auth from '../middleware/authentication.js';
import requireRole from '../middleware/requireRole.js';
import { 
  createRide, 
  updateRideStatus, 
  acceptRide, 
  getMyRides, 
  getAvailableRides, 
  rateRide, 
  verifyPickup,
  cancelRide,
  canCancelRide,
  getRideDetails
} from "../controllers/ride.js";

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

// Ride details route
router.get("/:rideId", auth, getRideDetails);

// Cancellation routes
router.put("/:rideId/cancel", auth, cancelRide);
router.get("/:rideId/can-cancel", auth, canCancelRide);

export default router;
