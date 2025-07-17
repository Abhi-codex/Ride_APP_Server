import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { BadRequestError, NotFoundError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import { calculateDistance, calculateFare, generateOTP } from "../utils/ambulance.js";

export const createRide = async (req, res) => {
  const { vehicle, pickup, drop, emergency } = req.body;

  if (!vehicle || !pickup || !drop) {
    throw new BadRequestError(
      "Ambulance type, pickup, and drop details are required"
    );
  }

  const validVehicleTypes = ["bls", "als", "ccs", "auto", "bike"];
  if (!validVehicleTypes.includes(vehicle)) {
    throw new BadRequestError(
      "Invalid ambulance type. Valid types: bls (Basic Life Support), als (Advanced Life Support), ccs (Critical Care Support), auto (Auto Ambulance), bike (Bike Safety Unit)"
    );
  }

  if (emergency) {
    const validEmergencyTypes = ['cardiac', 'trauma', 'respiratory', 'neurological', 'pediatric', 'obstetric', 'psychiatric', 'burns', 'poisoning', 'general'];
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    
    if (emergency.type && !validEmergencyTypes.includes(emergency.type)) {
      throw new BadRequestError(
        "Invalid emergency type. Valid types: " + validEmergencyTypes.join(", ")
      );
    }
    
    if (emergency.priority && !validPriorities.includes(emergency.priority)) {
      throw new BadRequestError(
        "Invalid emergency priority. Valid priorities: " + validPriorities.join(", ")
      );
    }
  }

  const { address: pickupAddress, latitude: pickupLat, longitude: pickupLon } = pickup;

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
      emergency: emergency || null,
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
    const { vehicle, emergency } = req.query;
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

    if (emergency) {
      query['emergency.type'] = emergency;
    }

    // Get driver information for filtering and scoring
    let driver = null;
    if (req.user.role === "driver") {
      driver = await User.findById(driverId);
      if (driver && driver.vehicle?.type) {
        query.vehicle = driver.vehicle.type;
      }
    }

    // Only show rides created within the last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    query.createdAt = { $gte: tenMinutesAgo };

    let availableRides = await Ride.find(query)
      .populate("customer", "phone")
      .sort({ createdAt: -1 });

    // Only show rides within 10 km radius of driver
    if (driver && driver.location && driver.location.latitude && driver.location.longitude) {
      const driverLat = driver.location.latitude;
      const driverLon = driver.location.longitude;
      availableRides = availableRides.filter(ride => {
        if (!ride.pickup || !ride.pickup.latitude || !ride.pickup.longitude) return false;
        const rideLat = ride.pickup.latitude;
        const rideLon = ride.pickup.longitude;
        // Haversine formula
        const toRad = (value) => (value * Math.PI) / 180;
        const R = 6371; // km
        const dLat = toRad(rideLat - driverLat);
        const dLon = toRad(rideLon - driverLon);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(driverLat)) * Math.cos(toRad(rideLat)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        return distance <= 10;
      });
    }

    // If driver is authenticated and has specializations, apply smart matching
    if (driver && driver.vehicle?.specializations && driver.vehicle.specializations.length > 0) {
      // Score and filter rides based on emergency type and driver specializations
      availableRides = availableRides.map(ride => {
        let compatibilityScore = 0;
        let priorityBonus = 0;

        // If ride has emergency information
        if (ride.emergency && ride.emergency.type) {
          const emergencyType = ride.emergency.type;

          // Perfect match: driver specializes in this emergency type
          if (driver.vehicle.specializations.includes(emergencyType)) {
            compatibilityScore += 100;
          }

          // Related specializations (cross-specialty matching)
          const relatedSpecs = getRelatedSpecializations(emergencyType);
          const driverSpecs = driver.vehicle.specializations;
          const relatedMatches = driverSpecs.filter(spec => relatedSpecs.includes(spec));
          compatibilityScore += relatedMatches.length * 25;

          // Priority bonus
          if (ride.emergency.priority) {
            const priorityScores = {
              'critical': 50,
              'high': 30,
              'medium': 15,
              'low': 5
            };
            priorityBonus = priorityScores[ride.emergency.priority] || 0;
          }
        }

        // General practice bonus (if driver has "general" specialization)
        if (driver.vehicle.specializations.includes('general')) {
          compatibilityScore += 20;
        }

        // Calculate final score
        const finalScore = compatibilityScore + priorityBonus;

        return {
          ...ride.toObject(),
          compatibilityScore: finalScore,
          isRecommended: finalScore >= 50, // Threshold for recommendation
          emergencyMatch: compatibilityScore >= 100 // Perfect specialization match
        };
      });

      // Sort by compatibility score (highest first) and then by creation time
      availableRides.sort((a, b) => {
        if (b.compatibilityScore !== a.compatibilityScore) {
          return b.compatibilityScore - a.compatibilityScore;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // Optional: Filter to only show rides with minimum compatibility
      // availableRides = availableRides.filter(ride => ride.compatibilityScore >= 25);
    }

    res.status(StatusCodes.OK).json({
      message: "Available emergency calls retrieved successfully",
      count: availableRides.length,
      rides: availableRides,
      driverSpecializations: driver?.vehicle?.specializations || [],
      emergencyMatching: driver?.vehicle?.specializations?.length > 0
    });
  } catch (error) {
    console.error("Error retrieving available rides:", error);
    throw new BadRequestError("Failed to retrieve available emergency calls");
  }
};

const getRelatedSpecializations = (emergencyType) => {
  const relatedMap = {
    'cardiac': ['general', 'respiratory'], // Cardiac issues often relate to breathing
    'trauma': ['general', 'burns'], // Trauma can involve burns
    'respiratory': ['cardiac', 'general'], // Breathing issues can affect heart
    'neurological': ['general', 'trauma'], // Neurological can result from trauma
    'pediatric': ['general', 'respiratory', 'trauma'], // Kids can have various issues
    'obstetric': ['general'], // Pregnancy relates to general care
    'psychiatric': ['general'], // Mental health with general support
    'burns': ['trauma', 'general'], // Burns are a type of trauma
    'poisoning': ['general', 'respiratory'], // Poisoning affects breathing
    'general': ['cardiac', 'trauma', 'respiratory'] // General covers basics of all
  };
  
  return relatedMap[emergencyType] || [];
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

export const getAllAvailableRides = async (req, res) => {
  try {
    const rides = await Ride.find({ status: "SEARCHING_FOR_RIDER" })
      .populate("customer", "name phone")
      .sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json({
      message: "Available rides retrieved successfully",
      count: rides.length,
      rides,
    });
  } catch (error) {
    console.error("Error retrieving available rides:", error);
    throw new BadRequestError("Failed to retrieve available rides");
  }
};