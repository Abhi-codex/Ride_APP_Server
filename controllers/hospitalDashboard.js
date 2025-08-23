import HospitalStaff from "../models/HospitalStaff.js";
import Hospital from "../models/Hospital.js";
import Driver from "../models/Driver.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";

// Hospital Staff Login - Simplified for demo purposes
        // Note: In the production version, you can verify using JWT
        // to check if the user has proper hospital access rights
        // In production, this integrates with your existing JWT auth
export const hospitalStaffLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  try {
    // Find staff member by email and populate hospital data
    const staffMember = await HospitalStaff.findOne({ email, isActive: true })
      .populate('hospitalId', 'name address location')
      .populate('user');

    if (!staffMember) {
      throw new UnauthenticatedError("Invalid credentials");
    }

    // Simple password check for demo (use proper hashing in production)
    if (password !== "password123") {
      throw new UnauthenticatedError("Invalid credentials");
    }

    // Update last login
    staffMember.lastLogin = new Date();
    await staffMember.save();

    // Generate JWT token directly for hospital staff
    const token = jwt.sign(
      {
        id: staffMember._id,
        email: staffMember.email,
        role: staffMember.role,
        hospitalId: staffMember.hospitalId._id,
        type: 'hospital-staff'
      },
      process.env.ACCESS_TOKEN_SECRET || 'hospital-fallback-secret',
      { expiresIn: '24h' }
    );

    res.status(StatusCodes.OK).json({
      staff: {
        id: staffMember._id,
        name: staffMember.name,
        email: staffMember.email,
        role: staffMember.role,
        department: staffMember.department,
        permissions: staffMember.permissions,
        hospital: staffMember.hospitalId
      },
      token,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// Get Hospital Dashboard Overview
export const getHospitalDashboard = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id })
      .populate('hospitalId');

    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const hospitalId = staffMember.hospitalId._id;

    // Get current date for filtering
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Get active rides heading to this hospital
    const activeRides = await Ride.find({
      'destinationHospital.hospitalId': hospitalId,
      status: { $in: ["SEARCHING_FOR_RIDER", "START", "ARRIVED"] }
    })
    .populate('customer', 'name phone')
    .populate('rider', 'name phone')
    .sort({ createdAt: -1 });

    // Get affiliated drivers
    const affiliatedDrivers = await Driver.find({
      'hospitalAffiliation.hospitalId': hospitalId.toString(),
      'hospitalAffiliation.isAffiliated': true
    })
    .populate('user', 'name phone');

    // Get today's completed rides
    const todayCompletedRides = await Ride.find({
      'destinationHospital.hospitalId': hospitalId,
      status: "COMPLETED",
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).countDocuments();

    // Get emergency statistics for today
    const emergencyStats = await Ride.aggregate([
      {
        $match: {
          'destinationHospital.hospitalId': hospitalId,
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: '$emergency.type',
          count: { $sum: 1 },
          criticalCount: {
            $sum: { $cond: [{ $eq: ['$emergency.priority', 'critical'] }, 1, 0] }
          }
        }
      }
    ]);

    // Get online affiliated drivers count
    const onlineDriversCount = await Driver.countDocuments({
      'hospitalAffiliation.hospitalId': hospitalId.toString(),
      'hospitalAffiliation.isAffiliated': true,
      isOnline: true
    });

    res.status(StatusCodes.OK).json({
      hospital: staffMember.hospitalId,
      activeRides: activeRides.length,
      todayCompletedRides,
      affiliatedDrivers: affiliatedDrivers.length,
      onlineDrivers: onlineDriversCount,
      emergencyStats,
      recentRides: activeRides.slice(0, 10), // Latest 10 active rides
      drivers: affiliatedDrivers
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// Get All Rides for Hospital (with pagination)
export const getHospitalRides = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const { page = 1, limit = 20, status, priority, emergencyType } = req.query;
    const hospitalId = staffMember.hospitalId;

    // Build filter
    const filter = { 'destinationHospital.hospitalId': hospitalId };
    
    if (status) filter.status = status;
    if (priority) filter['emergency.priority'] = priority;
    if (emergencyType) filter['emergency.type'] = emergencyType;

    const rides = await Ride.find(filter)
      .populate('customer', 'name phone')
      .populate('rider', 'name phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Ride.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      rides,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// Get Hospital's Affiliated Drivers
export const getHospitalDrivers = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const hospitalId = staffMember.hospitalId;

    const drivers = await Driver.find({
      'hospitalAffiliation.hospitalId': hospitalId.toString(),
      'hospitalAffiliation.isAffiliated': true
    })
    .populate('user', 'name phone email')
    .sort({ createdAt: -1 });

    // Get current rides for each driver
    const driversWithRides = await Promise.all(
      drivers.map(async (driver) => {
        const currentRide = await Ride.findOne({
          rider: driver.user._id,
          status: { $in: ["START", "ARRIVED"] }
        }).populate('customer', 'name phone');

        return {
          ...driver.toObject(),
          currentRide
        };
      })
    );

    res.status(StatusCodes.OK).json({ drivers: driversWithRides });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// Get Hospital Analytics
export const getHospitalAnalytics = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const { days = 7 } = req.query;
    const hospitalId = staffMember.hospitalId;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Daily ride statistics
    const dailyStats = await Ride.aggregate([
      {
        $match: {
          'destinationHospital.hospitalId': hospitalId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
          },
          totalRides: { $sum: 1 },
          completedRides: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          },
          criticalEmergencies: {
            $sum: { $cond: [{ $eq: ['$emergency.priority', 'critical'] }, 1, 0] }
          },
          averageRating: { $avg: '$rating' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Emergency type distribution
    const emergencyDistribution = await Ride.aggregate([
      {
        $match: {
          'destinationHospital.hospitalId': hospitalId,
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$emergency.type',
          count: { $sum: 1 },
          avgPriority: { $avg: { $cond: [
            { $eq: ['$emergency.priority', 'critical'] }, 4,
            { $cond: [
              { $eq: ['$emergency.priority', 'high'] }, 3,
              { $cond: [
                { $eq: ['$emergency.priority', 'medium'] }, 2, 1
              ]}
            ]}
          ]}}
        }
      }
    ]);

    res.status(StatusCodes.OK).json({
      dailyStats,
      emergencyDistribution,
      totalDays: parseInt(days)
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// Update Hospital Information (for authorized staff)
export const updateHospitalInfo = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember || !staffMember.permissions.manageHospitalInfo) {
      throw new UnauthenticatedError("Access denied");
    }

    const { totalBeds, availableBeds, operatingHours } = req.body;
    const hospitalId = staffMember.hospitalId;

    const updatedHospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        ...(totalBeds && { totalBeds }),
        ...(availableBeds && { availableBeds }),
        ...(operatingHours && { operatingHours }),
        lastUpdated: new Date()
      },
      { new: true }
    );

    res.status(StatusCodes.OK).json({ hospital: updatedHospital });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// Create Hospital Staff Account
export const createHospitalStaff = async (req, res) => {
  try {
    const { name, email, password, phone, hospitalId, role, department, permissions } = req.body;

    // Create User first
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: 'hospital_staff'
    });

    // Create Hospital Staff
    const staffMember = await HospitalStaff.create({
      user: user._id,
      name,
      email,
      phone,
      hospitalId,
      role: role || 'staff',
      department: department || 'emergency',
      permissions: permissions || {
        viewDashboard: true,
        manageDrivers: false,
        viewRides: true,
        manageHospitalInfo: false,
        viewAnalytics: true
      }
    });

    const populatedStaff = await HospitalStaff.findById(staffMember._id)
      .populate('hospitalId', 'name address');

    res.status(StatusCodes.CREATED).json({ 
      message: "Hospital staff created successfully",
      staff: populatedStaff 
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// Debug endpoint to check authentication
export const debugAuth = async (req, res) => {
  try {
    console.log('req.user:', req.user);
    
    const staffMember = await HospitalStaff.findOne({ user: req.user.id })
      .populate('hospitalId');
    
    console.log('Found staff member:', staffMember ? 'Yes' : 'No');
    
    res.status(StatusCodes.OK).json({
      user: req.user,
      staffFound: !!staffMember,
      staffMember: staffMember ? {
        id: staffMember._id,
        name: staffMember.name,
        email: staffMember.email
      } : null
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error.message });
  }
};

// 1. Get Incoming Patient Details
export const getIncomingPatients = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const hospitalId = staffMember.hospitalId;

    // Get all rides heading to this hospital that are not completed
    const incomingRides = await Ride.find({
      'destinationHospital.hospitalId': hospitalId,
      status: { $in: ["SEARCHING_FOR_RIDER", "START", "ARRIVED"] }
    })
    .populate('customer', 'name phone')
    .populate('rider', 'name phone')
    .populate({
      path: 'rider',
      populate: {
        path: 'user',
        model: 'User',
        select: 'name phone'
      }
    })
    .sort({ createdAt: -1 });

    // Format response with patient details, condition, ETA, ambulance ID
    const formattedPatients = incomingRides.map(ride => {
      const eta = ride.destinationHospital?.estimatedArrival || 
                 new Date(Date.now() + 30 * 60000); // Default 30 min ETA

      return {
        id: ride._id,
        ambulanceId: ride._id.toString().slice(-6).toUpperCase(),
        patient: {
          name: ride.customer?.name || "Emergency Patient",
          phone: ride.customer?.phone || null,
          relative: ride.contactInfo?.patientRelative || null
        },
        condition: {
          type: ride.emergency?.type || 'general',
          priority: ride.emergency?.priority || 'medium',
          description: ride.emergency?.name || 'Medical Emergency',
          specialInstructions: ride.contactInfo?.specialInstructions || null
        },
        eta: eta,
        timeToArrival: Math.max(0, Math.floor((eta - new Date()) / 60000)), // minutes
        ambulance: {
          type: ride.vehicle?.toUpperCase(),
          status: ride.status,
          driver: ride.rider ? {
            name: ride.rider.name,
            phone: ride.rider.phone
          } : null,
          currentLocation: ride.liveTracking?.currentLocation || null
        },
        pickup: ride.pickup,
        createdAt: ride.createdAt,
        estimatedDistance: ride.distance || 0
      };
    });

    res.status(StatusCodes.OK).json({
      success: true,
      count: formattedPatients.length,
      patients: formattedPatients
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 2. Get Live Ambulance Tracking Data
export const getLiveAmbulanceTracking = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const hospitalId = staffMember.hospitalId;

    // Get all ambulances (both coming to hospital and general ones in area)
    const allActiveRides = await Ride.find({
      status: { $in: ["START", "ARRIVED"] },
      $or: [
        { 'destinationHospital.hospitalId': hospitalId },
        { 'liveTracking.currentLocation': { $exists: true } }
      ]
    })
    .populate('rider', 'name phone')
    .populate('customer', 'name phone')
    .select('_id vehicle status liveTracking destinationHospital rider customer pickup drop emergency');

    // Get affiliated drivers locations
    const affiliatedDrivers = await Driver.find({
      'hospitalAffiliation.hospitalId': hospitalId.toString(),
      'hospitalAffiliation.isAffiliated': true,
      isOnline: true
    })
    .populate('user', 'name phone');

    const ambulanceLocations = allActiveRides.map(ride => ({
      id: ride._id,
      ambulanceId: ride._id.toString().slice(-6).toUpperCase(),
      type: ride.vehicle,
      status: ride.status,
      isComingToThisHospital: ride.destinationHospital?.hospitalId?.toString() === hospitalId.toString(),
      currentLocation: ride.liveTracking?.currentLocation || ride.pickup,
      destination: ride.drop,
      driver: ride.rider ? {
        id: ride.rider._id,
        name: ride.rider.name,
        phone: ride.rider.phone
      } : null,
      patient: {
        name: ride.customer?.name || "Emergency Patient",
        condition: ride.emergency?.type || 'general',
        priority: ride.emergency?.priority || 'medium'
      },
      lastUpdated: ride.liveTracking?.lastUpdated || ride.updatedAt
    }));

    // Add affiliated drivers who are online but not on a ride
    const driverLocations = affiliatedDrivers
      .filter(driver => !ambulanceLocations.find(amb => amb.driver?.id?.toString() === driver.user._id.toString()))
      .map(driver => ({
        id: `driver_${driver._id}`,
        ambulanceId: `FREE-${driver._id.toString().slice(-4).toUpperCase()}`,
        type: driver.vehicle?.type || 'unknown',
        status: 'AVAILABLE',
        isComingToThisHospital: false,
        currentLocation: null, // Would need to implement driver location tracking
        destination: null,
        driver: {
          id: driver.user._id,
          name: driver.user.name,
          phone: driver.user.phone
        },
        patient: null,
        lastUpdated: new Date()
      }));

    res.status(StatusCodes.OK).json({
      success: true,
      totalAmbulances: ambulanceLocations.length + driverLocations.length,
      comingToHospital: ambulanceLocations.filter(amb => amb.isComingToThisHospital).length,
      ambulances: [...ambulanceLocations, ...driverLocations]
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 3. Get Ambulance Status Overview
export const getAmbulanceStatus = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const hospitalId = staffMember.hospitalId;

    // Get affiliated drivers
    const affiliatedDrivers = await Driver.find({
      'hospitalAffiliation.hospitalId': hospitalId.toString(),
      'hospitalAffiliation.isAffiliated': true
    })
    .populate('user', 'name phone');

    // Get current rides for affiliated drivers
    const activeRides = await Ride.find({
      rider: { $in: affiliatedDrivers.map(d => d.user._id) },
      status: { $in: ["START", "ARRIVED"] }
    })
    .populate('customer', 'name');

    // Create status overview
    const statusOverview = affiliatedDrivers.map(driver => {
      const currentRide = activeRides.find(ride => 
        ride.rider.toString() === driver.user._id.toString()
      );

      return {
        driverId: driver._id,
        ambulanceId: driver._id.toString().slice(-4).toUpperCase(),
        driver: {
          name: driver.user.name,
          phone: driver.user.phone
        },
        vehicle: {
          type: driver.vehicle?.type || 'unknown',
          plateNumber: driver.vehicle?.plateNumber || 'N/A'
        },
        status: driver.isOnline ? (currentRide ? 'OCCUPIED' : 'FREE') : 'OFFLINE',
        isOnline: driver.isOnline,
        currentRide: currentRide ? {
          id: currentRide._id,
          patient: currentRide.customer?.name || 'Emergency Patient',
          status: currentRide.status,
          emergency: currentRide.emergency?.type || 'general'
        } : null,
        lastSeen: driver.updatedAt
      };
    });

    const summary = {
      total: affiliatedDrivers.length,
      online: statusOverview.filter(s => s.isOnline).length,
      free: statusOverview.filter(s => s.status === 'FREE').length,
      occupied: statusOverview.filter(s => s.status === 'OCCUPIED').length,
      offline: statusOverview.filter(s => s.status === 'OFFLINE').length
    };

    res.status(StatusCodes.OK).json({
      success: true,
      summary,
      ambulances: statusOverview
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 4. Get Contact Information for Emergency Communication
export const getEmergencyContacts = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const hospitalId = staffMember.hospitalId;
    const { rideId } = req.params;

    if (rideId) {
      // Get specific ride contact info
      const ride = await Ride.findById(rideId)
        .populate('customer', 'name phone')
        .populate('rider', 'name phone');

      if (!ride || ride.destinationHospital?.hospitalId?.toString() !== hospitalId.toString()) {
        return res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          error: "Ride not found or not assigned to this hospital"
        });
      }

      res.status(StatusCodes.OK).json({
        success: true,
        contacts: {
          patient: {
            name: ride.customer?.name || "Emergency Patient",
            phone: ride.customer?.phone || null
          },
          relative: ride.contactInfo?.patientRelative || null,
          driver: ride.rider ? {
            name: ride.rider.name,
            phone: ride.rider.phone
          } : null,
          ambulanceId: ride._id.toString().slice(-6).toUpperCase(),
          specialInstructions: ride.contactInfo?.specialInstructions || null
        }
      });
    } else {
      // Get all emergency contacts for incoming patients
      const incomingRides = await Ride.find({
        'destinationHospital.hospitalId': hospitalId,
        status: { $in: ["SEARCHING_FOR_RIDER", "START", "ARRIVED"] }
      })
      .populate('customer', 'name phone')
      .populate('rider', 'name phone')
      .select('_id customer rider contactInfo emergency');

      const allContacts = incomingRides.map(ride => ({
        rideId: ride._id,
        ambulanceId: ride._id.toString().slice(-6).toUpperCase(),
        patient: {
          name: ride.customer?.name || "Emergency Patient",
          phone: ride.customer?.phone || null
        },
        relative: ride.contactInfo?.patientRelative || null,
        driver: ride.rider ? {
          name: ride.rider.name,
          phone: ride.rider.phone
        } : null,
        emergency: ride.emergency?.type || 'general',
        priority: ride.emergency?.priority || 'medium'
      }));

      res.status(StatusCodes.OK).json({
        success: true,
        count: allContacts.length,
        contacts: allContacts
      });
    }

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 5. Update Bed Availability
export const updateBedAvailability = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember || !staffMember.permissions.manageHospitalInfo) {
      throw new UnauthenticatedError("Access denied - insufficient permissions");
    }

    const hospitalId = staffMember.hospitalId;
    const { bedDetails, totalBeds, availableBeds } = req.body;

    const updateData = {
      lastUpdated: new Date()
    };

    if (bedDetails) {
      if (bedDetails.icu) {
        updateData['bedDetails.icu.total'] = bedDetails.icu.total;
        updateData['bedDetails.icu.available'] = bedDetails.icu.available;
      }
      if (bedDetails.general) {
        updateData['bedDetails.general.total'] = bedDetails.general.total;
        updateData['bedDetails.general.available'] = bedDetails.general.available;
      }
      if (bedDetails.emergency) {
        updateData['bedDetails.emergency.total'] = bedDetails.emergency.total;
        updateData['bedDetails.emergency.available'] = bedDetails.emergency.available;
      }
    }

    if (totalBeds !== undefined) updateData.totalBeds = totalBeds;
    if (availableBeds !== undefined) updateData.availableBeds = availableBeds;

    const updatedHospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      updateData,
      { new: true }
    );

    // Emit real-time update to all connected clients
    if (req.io) {
      req.io.emit('bedAvailabilityUpdate', {
        hospitalId: hospitalId,
        bedDetails: updatedHospital.bedDetails,
        totalBeds: updatedHospital.totalBeds,
        availableBeds: updatedHospital.availableBeds,
        lastUpdated: updatedHospital.lastUpdated
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Bed availability updated successfully",
      hospital: {
        id: updatedHospital._id,
        name: updatedHospital.name,
        bedDetails: updatedHospital.bedDetails,
        totalBeds: updatedHospital.totalBeds,
        availableBeds: updatedHospital.availableBeds,
        lastUpdated: updatedHospital.lastUpdated
      }
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 6. Get Current Bed Availability
export const getBedAvailability = async (req, res) => {
  try {
    const staffMember = await HospitalStaff.findOne({ user: req.user.id });
    
    if (!staffMember) {
      throw new UnauthenticatedError("Access denied");
    }

    const hospital = await Hospital.findById(staffMember.hospitalId)
      .select('name bedDetails totalBeds availableBeds lastUpdated');

    res.status(StatusCodes.OK).json({
      success: true,
      hospital: {
        id: hospital._id,
        name: hospital.name,
        bedDetails: hospital.bedDetails || {
          icu: { total: 0, available: 0 },
          general: { total: 0, available: 0 },
          emergency: { total: 0, available: 0 }
        },
        totalBeds: hospital.totalBeds || 0,
        availableBeds: hospital.availableBeds || 0,
        lastUpdated: hospital.lastUpdated
      }
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 7. Update Live Location for Ambulance (Called by driver app)
export const updateAmbulanceLocation = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      throw new BadRequestError("Latitude and longitude are required");
    }

    const ride = await Ride.findByIdAndUpdate(
      rideId,
      {
        'liveTracking.currentLocation.latitude': latitude,
        'liveTracking.currentLocation.longitude': longitude,
        'liveTracking.lastUpdated': new Date()
      },
      { new: true }
    ).populate('destinationHospital.hospitalId');

    // Emit real-time location update
    if (req.io && ride.destinationHospital?.hospitalId) {
      req.io.emit('ambulanceLocationUpdate', {
        rideId: ride._id,
        ambulanceId: ride._id.toString().slice(-6).toUpperCase(),
        location: {
          latitude,
          longitude
        },
        hospitalId: ride.destinationHospital.hospitalId,
        timestamp: new Date()
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Location updated successfully"
    });

  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
  }
};
