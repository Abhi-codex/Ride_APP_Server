import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { BadRequestError, NotFoundError, UnauthenticatedError } from "../errors/index.js";
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

    // Fetch hospital details for drop location
    let hospitalDetails = null;
    try {
      const hospitals = await import("./hospital.js");
      // Use hospital search logic to find nearest hospital to drop location
      const hospitalQuery = {
        lat: dropLat,
        lng: dropLon,
        radius: 5000
      };
      // Simulate a request object for hospital search
      const reqObj = { query: hospitalQuery };
      const resObj = {
        status: () => ({ json: (data) => data }),
      };
      const result = await hospitals.searchHospitals(reqObj, resObj);
      if (result && result.hospitals && result.hospitals.length > 0) {
        hospitalDetails = result.hospitals[0];
      }
    } catch (err) {
      // Fallback to DB if API fails
      const Hospital = (await import("../models/Hospital.js")).default;
      const dbHospitals = await Hospital.find({});
      hospitalDetails = dbHospitals.length > 0 ? dbHospitals[0] : null;
    }

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
      destinationHospital: hospitalDetails ? {
        hospitalId: hospitalDetails._id,
        hospitalName: hospitalDetails.name,
        estimatedArrival: null
      } : null
    });

    await ride.save();

    res.status(StatusCodes.CREATED).json({
      message: "Emergency call created successfully",
      ride: {
        ...ride.toObject(),
        hospitalDetails: hospitalDetails || null
      },
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
    // Use Driver model for vehicle info
    const driverProfile = await (await import("../models/Driver.js")).default.findOne({ user: driverId });
    if (!driverProfile) {
      throw new BadRequestError("Driver profile not found");
    }
    if (!driverProfile.vehicle || !driverProfile.vehicle.type) {
      throw new BadRequestError("Driver must complete vehicle profile before accepting rides");
    }
    // Validate driver has the required ambulance type
    if (driverProfile.vehicle.type !== ride.vehicle) {
      throw new BadRequestError(
        `Driver's ambulance type (${driverProfile.vehicle.type}) does not match required type (${ride.vehicle})`
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

    // Debug: Check what's available on req
    console.log('DEBUG: req.io exists:', !!req.io);
    console.log('DEBUG: req.io value:', req.io);
    console.log('DEBUG: req.io type:', typeof req.io);
    console.log('DEBUG: req.socket exists:', !!req.socket);
    console.log('DEBUG: Available req properties:', Object.keys(req).filter(key => key.includes('io') || key.includes('socket')));

    if (req.io && typeof req.io.to === 'function') {
      req.io.to(`ride_${rideId}`).emit("rideUpdate", ride);
      req.io.to(`ride_${rideId}`).emit("rideAccepted");
    } else {
      console.log('WARNING: req.io.to is not available, skipping socket events');
    }

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

    req.io.to(`ride_${rideId}`).emit("rideUpdate", ride);

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

    // Attach hospital details to each ride
    const Hospital = (await import("../models/Hospital.js")).default;
    const hospitalMap = {};
    for (const ride of rides) {
      if (ride.hospital) {
        if (!hospitalMap[ride.hospital]) {
          hospitalMap[ride.hospital] = await Hospital.findOne({ placeId: ride.hospital });
        }
        ride.hospitalDetails = hospitalMap[ride.hospital];
      }
    }

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
    
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      throw new BadRequestError("User authentication required");
    }
    
    // Check if user has proper role
    if (!req.user.role) {
      throw new BadRequestError("User role not found");
    }
    
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
      driver = await (await import("../models/Driver.js")).default.findOne({ user: driverId });
      if (driver && driver.vehicle && driver.vehicle.type) {
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

    // Attach hospital details to each available ride
    const Hospital = (await import("../models/Hospital.js")).default;
    const hospitalMap = {};
    for (const ride of availableRides) {
      if (ride.hospital) {
        if (!hospitalMap[ride.hospital]) {
          hospitalMap[ride.hospital] = await Hospital.findOne({ placeId: ride.hospital });
        }
        ride.hospitalDetails = hospitalMap[ride.hospital];
      }
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

// OTP verification attempts tracking (in production, use Redis or database)
const otpVerificationAttempts = new Map();

// Clean expired OTP attempts
const cleanExpiredOtpAttempts = () => {
  const now = Date.now();
  for (const [key, data] of otpVerificationAttempts.entries()) {
    if (now > data.resetTime) {
      otpVerificationAttempts.delete(key);
    }
  }
};

// Check if OTP verification is rate limited
const isOtpRateLimited = (rideId) => {
  cleanExpiredOtpAttempts();
  const attempts = otpVerificationAttempts.get(rideId);
  if (!attempts) return false;
  
  return attempts.count >= 5; // Max 5 attempts per 10 minutes
};

// Track OTP verification attempt
const trackOtpAttempt = (rideId) => {
  cleanExpiredOtpAttempts();
  const now = Date.now();
  const resetTime = now + 10 * 60 * 1000; // 10 minutes
  
  const attempts = otpVerificationAttempts.get(rideId);
  if (attempts) {
    attempts.count++;
  } else {
    otpVerificationAttempts.set(rideId, { count: 1, resetTime });
  }
};

export const verifyPickup = async (req, res) => {
  try {
    const { rideId, otp, driverLocation } = req.body;
    const driverId = req.user.id;

    // Validate required fields
    if (!rideId || !otp || !driverLocation?.latitude || !driverLocation?.longitude) {
      throw new BadRequestError("Ride ID, OTP, and driver location are required");
    }

    // Check rate limiting for OTP verification
    if (isOtpRateLimited(rideId)) {
      return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        error: "Rate limit exceeded",
        message: "Too many OTP verification attempts. Please try again later."
      });
    }

    // Find the ride
    const ride = await Ride.findById(rideId)
      .populate("customer", "name phone")
      .populate("rider", "name phone");

    if (!ride) {
      throw new NotFoundError("Ride not found");
    }

    // Verify that the driver is assigned to this ride
    if (!ride.rider || ride.rider._id.toString() !== driverId) {
      throw new UnauthenticatedError("You are not assigned to this ride");
    }

    // Check if ride is in correct status
    if (ride.status !== "START") {
      throw new BadRequestError("Ride must be in START status to verify pickup");
    }

    // Check if OTP has expired (assuming 10 minutes validity)
    const otpCreatedTime = ride.updatedAt; // Assuming OTP was created when ride status changed to START
    const otpExpiryTime = new Date(otpCreatedTime.getTime() + 10 * 60 * 1000); // 10 minutes
    const now = new Date();

    if (now > otpExpiryTime) {
      trackOtpAttempt(rideId);
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: "OTP expired",
        message: "The OTP has expired. Please contact the patient for a new OTP."
      });
    }

    // Verify OTP
    if (ride.otp !== otp) {
      trackOtpAttempt(rideId);
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Invalid OTP",
        message: "The provided OTP is incorrect"
      });
    }

    // Calculate distance between driver location and pickup location
    const distanceToPickup = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      ride.pickup.latitude,
      ride.pickup.longitude
    );

    // Check if driver is within 100 meters (0.1 km) of pickup location
    const maxAllowedDistance = 0.1; // 100 meters in kilometers
    if (distanceToPickup > maxAllowedDistance) {
      trackOtpAttempt(rideId);
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Location verification failed",
        message: "Driver is not at the pickup location",
        details: {
          distanceToPickup: Math.round(distanceToPickup * 1000), // distance in meters
          requiredDistance: Math.round(maxAllowedDistance * 1000) // required distance in meters
        }
      });
    }

    // All verifications passed - update ride status
    ride.status = "ARRIVED";
    
    // Update driver location in live tracking
    if (!ride.liveTracking) {
      ride.liveTracking = {};
    }
    ride.liveTracking.driverLocation = {
      latitude: driverLocation.latitude,
      longitude: driverLocation.longitude
    };
    ride.liveTracking.lastUpdated = new Date();

    await ride.save();

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.to(`ride_${rideId}`).emit("rideUpdate", {
        rideId: ride._id,
        status: ride.status,
        message: "Pickup verified successfully",
        driverLocation: ride.liveTracking.driverLocation
      });

      // Notify patient about successful pickup verification
      req.io.to(`user_${ride.customer._id}`).emit("pickupVerified", {
        rideId: ride._id,
        driverName: ride.rider.name,
        message: "Your driver has arrived and pickup has been verified"
      });
    }

    // Clear OTP verification attempts for this ride
    otpVerificationAttempts.delete(rideId);

    // Log verification for audit trail
    console.log(`Pickup verified successfully for ride ${rideId} by driver ${driverId} at ${new Date().toISOString()}`);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Pickup verified successfully",
      ride: {
        _id: ride._id,
        status: ride.status,
        customer: ride.customer,
        rider: ride.rider,
        pickup: ride.pickup,
        drop: ride.drop,
        emergency: ride.emergency,
        liveTracking: ride.liveTracking,
        destinationHospital: ride.destinationHospital
      }
    });

  } catch (error) {
    console.error("Error verifying pickup:", error);
    
    // Handle different types of errors
    if (error instanceof BadRequestError || 
        error instanceof NotFoundError || 
        error instanceof UnauthenticatedError) {
      throw error;
    }
    
    // For unexpected errors
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Server error",
      message: "Failed to verify pickup"
    });
  }
};