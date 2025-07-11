import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import {
  calculateDistance,
  calculateFare,
  generateOTP,
} from "../utils/mapUtils.js";

export const createRide = async (req, res) => {
  const { vehicle, pickup, drop } = req.body;

  if (!vehicle || !pickup || !drop) {
    throw new BadRequestError(
      "Ambulance type, pickup, and drop details are required"
    );
  }

  // Validate ambulance type with new types
  const validVehicleTypes = ["bls", "als", "ccs", "auto", "bike"];
  if (!validVehicleTypes.includes(vehicle)) {
    throw new BadRequestError(
      "Invalid ambulance type. Valid types: bls (Basic Life Support), als (Advanced Life Support), ccs (Critical Care Support), auto (Auto Ambulance), bike (Bike Safety Unit)"
    );
  }

  const {
    address: pickupAddress,
    latitude: pickupLat,
    longitude: pickupLon,
  } = pickup;

  const { address: dropAddress, latitude: dropLat, longitude: dropLon } = drop;

  if (
    !pickupAddress ||
    !pickupLat ||
    !pickupLon ||
    !dropAddress ||
    !dropLat ||
    !dropLon
  ) {
    throw new BadRequestError("Complete pickup and drop details are required");
  }

  const patient = req.user;

  try {
    const distance = calculateDistance(pickupLat, pickupLon, dropLat, dropLon);
    const fare = calculateFare(distance);

    const ride = new Ride({
      vehicle,
      distance,
      fare: fare[vehicle],
      pickup: {
        address: pickupAddress,
        latitude: pickupLat,
        longitude: pickupLon,
      },
      drop: { address: dropAddress, latitude: dropLat, longitude: dropLon },
      customer: patient.id,
      otp: generateOTP(),
    });

    await ride.save();

    res.status(StatusCodes.CREATED).json({
      message: "Emergency call created successfully",
      ride,
    });
  } catch (error) {
    console.error(error);
    throw new BadRequestError("Failed to create emergency call");
  }
};

export const acceptRide = async (req, res) => {
  const driverId = req.user.id;
  const { rideId } = req.params;

  if (!rideId) {
    throw new BadRequestError("Emergency call ID is required");
  }

  try {
    let ride = await Ride.findById(rideId).populate("customer");

    if (!ride) {
      throw new NotFoundError("Emergency call not found");
    }

    if (ride.status !== "SEARCHING_FOR_RIDER") {
      throw new BadRequestError(
        "Emergency call is no longer available for assignment"
      );
    }

    // Get driver details to check for hospital affiliation
    const driver = await User.findById(driverId);
    if (!driver) {
      throw new BadRequestError("Driver not found");
    }

    // Validate driver has the required ambulance type
    if (driver.vehicle.type !== ride.vehicle) {
      throw new BadRequestError(
        `Driver's ambulance type (${driver.vehicle.type}) does not match required type (${ride.vehicle})`
      );
    }

    // Recalculate fare if driver is hospital-affiliated with custom formula
    if (driver.hospitalAffiliation?.isAffiliated && 
        driver.hospitalAffiliation?.customFareFormula?.baseFare) {
      const recalculatedFare = calculateFare(
        ride.distance, 
        ride.vehicle, 
        driver.hospitalAffiliation.customFareFormula
      );
      ride.fare = recalculatedFare[ride.vehicle];
    }

    ride.rider = driverId;
    ride.status = "START";
    await ride.save();

    ride = await ride.populate("rider");

    req.socket.to(`ride_${rideId}`).emit("rideUpdate", ride);
    req.socket.to(`ride_${rideId}`).emit("rideAccepted");

    res.status(StatusCodes.OK).json({
      message: "Emergency call accepted successfully",
      ride,
    });
  } catch (error) {
    console.error("Error accepting ride:", error);
    throw new BadRequestError("Failed to accept emergency call");
  }
};

export const updateRideStatus = async (req, res) => {
  const { rideId } = req.params;
  const { status } = req.body;

  if (!rideId || !status) {
    throw new BadRequestError("Emergency call ID and status are required");
  }

  try {
    let ride = await Ride.findById(rideId).populate("customer rider");

    if (!ride) {
      throw new NotFoundError("Emergency call not found");
    }

    if (!["START", "ARRIVED", "COMPLETED"].includes(status)) {
      throw new BadRequestError("Invalid emergency call status");
    }

    ride.status = status;
    await ride.save();

    req.socket.to(`ride_${rideId}`).emit("rideUpdate", ride);

    res.status(StatusCodes.OK).json({
      message: `Emergency call status updated to ${status}`,
      ride,
    });
  } catch (error) {
    console.error("Error updating ride status:", error);
    throw new BadRequestError("Failed to update emergency call status");
  }
};

export const getMyRides = async (req, res) => {
  const userId = req.user.id;
  const { status } = req.query;

  try {
    const query = {
      $or: [{ customer: userId }, { rider: userId }],
    };

    if (status) {
      query.status = status;
    }

    const rides = await Ride.find(query)
      .populate("customer", "name phone")
      .populate("rider", "name phone")
      .sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      message: "Emergency calls retrieved successfully",
      count: rides.length,
      rides,
    });
  } catch (error) {
    console.error("Error retrieving rides:", error);
    throw new BadRequestError("Failed to retrieve emergency calls");
  }
};

export const getAvailableRides = async (req, res) => {
  try {
    const { vehicle } = req.query;
    const driverId = req.user.id;

    // Build query for available rides
    const query = { status: "SEARCHING_FOR_RIDER" };
    
    // Filter by ambulance type if specified
    if (vehicle) {
      const validVehicleTypes = ["bls", "als", "ccs", "auto", "bike"];
      if (!validVehicleTypes.includes(vehicle)) {
        throw new BadRequestError(
          "Invalid ambulance type. Valid types: bls, als, ccs, auto, bike"
        );
      }
      query.vehicle = vehicle;
    }

    // If driver is authenticated, filter by their ambulance type
    if (req.user.role === "driver") {
      const driver = await User.findById(driverId);
      if (driver && driver.vehicle?.type) {
        query.vehicle = driver.vehicle.type;
      }
    }

    const availableRides = await Ride.find(query)
      .populate("customer", "phone")
      .sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      message: "Available emergency calls retrieved successfully",
      count: availableRides.length,
      rides: availableRides,
    });
  } catch (error) {
    console.error("Error retrieving available rides:", error);
    throw new BadRequestError("Failed to retrieve available emergency calls");
  }
};

export const rateRide = async (req, res) => {
  const { rideId } = req.params;
  const { rating } = req.body;
  const userId = req.user.id;

  if (!rideId || !rating) {
    throw new BadRequestError("Emergency call ID and rating are required");
  }

  if (rating < 1 || rating > 5) {
    throw new BadRequestError("Rating must be between 1 and 5");
  }

  try {
    const ride = await Ride.findById(rideId).populate("customer rider");

    if (!ride) {
      throw new NotFoundError("Emergency call not found");
    }

    if (ride.status !== "COMPLETED") {
      throw new BadRequestError("Can only rate completed emergency calls");
    }

    if (ride.customer._id.toString() !== userId) {
      throw new BadRequestError(
        "Only the patient can rate this emergency call"
      );
    }

    if (ride.rating) {
      throw new BadRequestError("This emergency call has already been rated");
    }

    ride.rating = rating;
    await ride.save();

    res.status(StatusCodes.OK).json({
      message: "Emergency call rated successfully",
      ride: {
        _id: ride._id,
        rating: ride.rating,
        status: ride.status,
      },
    });
  } catch (error) {
    console.error("Error rating emergency call:", error);
    throw new BadRequestError("Failed to rate emergency call");
  }
};
