import HospitalStaff from "../models/HospitalStaff.js";
import Hospital from "../models/Hospital.js";
import Driver from "../models/Driver.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import NodeCache from "node-cache";
import mongoose from "mongoose";

// Initialize cache with 5-minute default TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Track login attempts for rate limiting
const loginAttempts = new Map();

/**
 * Clean expired login attempts
 */
const cleanExpiredAttempts = () => {
  const now = Date.now();
  for (const [key, data] of loginAttempts.entries()) {
    if (now > data.resetTime) {
      loginAttempts.delete(key);
    }
  }
};

/**
 * Check if IP is rate limited
 */
const isRateLimited = (ip) => {
  cleanExpiredAttempts();
  const attempts = loginAttempts.get(ip);
  return attempts && attempts.count >= 5 && Date.now() < attempts.resetTime;
};

/**
 * Record failed login attempt
 */
const recordFailedAttempt = (ip) => {
  cleanExpiredAttempts();
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, resetTime: now + 15 * 60 * 1000 };
  
  attempts.count += 1;
  if (attempts.count >= 5) {
    attempts.resetTime = now + 15 * 60 * 1000; // 15 minutes lockout
  }
  
  loginAttempts.set(ip, attempts);
};

/**
 * Clear login attempts on successful login
 */
const clearFailedAttempts = (ip) => {
  loginAttempts.delete(ip);
};

export const hospitalStaffLogin = async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  try {
    // Check rate limiting
    if (isRateLimited(clientIP)) {
      return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        error: "Too many failed login attempts. Please try again in 15 minutes."
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError("Please provide email and password");
    }

    // Find staff member by email and populate hospital data
    const staffMember = await HospitalStaff.findOne({ 
      email: email.toLowerCase().trim(), 
      isActive: true 
    })
    .populate('hospitalId', 'name address location')
    .select('+hashedPassword +loginAttempts +lastFailedLogin');

    if (!staffMember) {
      recordFailedAttempt(clientIP);
      throw new UnauthenticatedError("Invalid credentials");
    }

    // Check if account is locked due to too many failed attempts
    if (staffMember.loginAttempts >= 5) {
      const lockoutTime = 15 * 60 * 1000; // 15 minutes
      const timeSinceLastFailed = Date.now() - new Date(staffMember.lastFailedLogin).getTime();
      
      if (timeSinceLastFailed < lockoutTime) {
        recordFailedAttempt(clientIP);
        throw new UnauthenticatedError("Account temporarily locked due to too many failed attempts");
      } else {
        // Reset attempts if lockout period has passed
        staffMember.loginAttempts = 0;
        staffMember.lastFailedLogin = null;
      }
    }

    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(password, staffMember.hashedPassword);
    
    if (!isValidPassword) {
      // Record failed attempt
      staffMember.loginAttempts = (staffMember.loginAttempts || 0) + 1;
      staffMember.lastFailedLogin = new Date();
      await staffMember.save();
      
      recordFailedAttempt(clientIP);
      throw new UnauthenticatedError("Invalid credentials");
    }

    // Successful login - reset attempts
    staffMember.loginAttempts = 0;
    staffMember.lastFailedLogin = null;
    staffMember.lastLogin = new Date();
    await staffMember.save();
    
    clearFailedAttempts(clientIP);

    // Generate JWT token with consistent secret
    const token = jwt.sign(
      {
        id: staffMember._id,
        email: staffMember.email,
        role: staffMember.role,
        hospitalId: staffMember.hospitalId._id,
        type: 'hospital-staff'
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log successful login for audit
    console.log(`Hospital staff login: ${staffMember.email} from ${clientIP} at ${new Date()}`);

    res.status(StatusCodes.OK).json({
      success: true,
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
    console.error(`Hospital login error for IP ${clientIP}:`, error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Get Hospital Dashboard Overview
export const getHospitalDashboard = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const cacheKey = `dashboard-${hospitalId}`;
    
    // Try cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(StatusCodes.OK).json({
        success: true,
        cached: true,
        ...cached
      });
    }

    // Get current date for filtering
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Parallel database queries for better performance
    const [activeRides, affiliatedDrivers, todayCompletedRides, emergencyStats, onlineDriversCount] = await Promise.all([
      // Get active rides heading to this hospital
      Ride.find({
        'destinationHospital.hospitalId': hospitalId,
        status: { $in: ["SEARCHING_FOR_RIDER", "START", "ARRIVED"] }
      })
      .populate('customer', 'name phone')
      .populate('rider', 'name phone')
      .sort({ createdAt: -1 })
      .limit(20), // Limit for performance

      // Get affiliated drivers
      Driver.find({
        'hospitalAffiliation.hospitalId': hospitalId.toString(),
        'hospitalAffiliation.isAffiliated': true
      })
      .populate('user', 'name phone')
      .select('user vehicle isOnline updatedAt')
      .limit(50), // Reasonable limit

      // Get today's completed rides count
      Ride.countDocuments({
        'destinationHospital.hospitalId': hospitalId,
        status: "COMPLETED",
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }),

      // Get emergency statistics for today
      Ride.aggregate([
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
        },
        { $limit: 10 } // Limit emergency types
      ]),

      // Get online affiliated drivers count
      Driver.countDocuments({
        'hospitalAffiliation.hospitalId': hospitalId.toString(),
        'hospitalAffiliation.isAffiliated': true,
        isOnline: true
      })
    ]);

    const dashboardData = {
      hospital: req.user.staffMember.hospitalId,
      statistics: {
        activeRides: activeRides.length,
        todayCompletedRides,
        affiliatedDrivers: affiliatedDrivers.length,
        onlineDrivers: onlineDriversCount
      },
      emergencyStats,
      recentRides: activeRides.slice(0, 10), // Latest 10 active rides
      drivers: affiliatedDrivers.slice(0, 20), // Top 20 drivers
      lastUpdated: new Date()
    };

    // Cache for 2 minutes
    cache.set(cacheKey, dashboardData, 120);

    res.status(StatusCodes.OK).json({
      success: true,
      cached: false,
      ...dashboardData
    });

  } catch (error) {
    console.error(`Dashboard error for hospital ${req.user.hospitalId}:`, error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: "Failed to load dashboard data. Please try again."
    });
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

    // Check if email already exists
    const existingStaff = await HospitalStaff.findOne({ email: email.toLowerCase().trim() });
    if (existingStaff) {
      throw new BadRequestError("Email already registered");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      throw new BadRequestError("Email already registered in the system");
    }

    // Verify hospital exists
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      throw new BadRequestError("Invalid hospital ID");
    }

    // Hash password with bcrypt
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create User first
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone.trim(),
      role: 'hospital_staff'
    });

    // Create Hospital Staff with secure defaults
    const staffMember = await HospitalStaff.create({
      user: user._id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      hospitalId,
      role: role || 'staff',
      department: department || 'emergency',
      hashedPassword: hashedPassword,
      permissions: permissions || {
        viewDashboard: true,
        manageDrivers: false,
        viewRides: true,
        manageHospitalInfo: false,
        viewAnalytics: true
      },
      loginAttempts: 0,
      isActive: true
    });

    const populatedStaff = await HospitalStaff.findById(staffMember._id)
      .populate('hospitalId', 'name address')
      .select('-hashedPassword -loginAttempts');

    // Log account creation for audit
    console.log(`Hospital staff account created: ${email} for hospital ${hospitalId} at ${new Date()}`);

    res.status(StatusCodes.CREATED).json({ 
      success: true,
      message: "Hospital staff created successfully",
      staff: populatedStaff 
    });

  } catch (error) {
    console.error('Create staff error:', error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message 
    });
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
    const hospitalId = req.user.hospitalId;
    const cacheKey = `incoming-patients-${hospitalId}`;
    
    // Try cache first (shorter cache time for real-time data)
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(StatusCodes.OK).json({
        success: true,
        cached: true,
        ...cached
      });
    }

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
    .sort({ 'emergency.priority': -1, createdAt: -1 }) // Priority first, then newest
    .limit(50); // Reasonable limit for performance

    if (!incomingRides || incomingRides.length === 0) {
      const response = {
        count: 0,
        patients: [],
        message: "No incoming patients at this time"
      };
      
      // Cache empty result for shorter time
      cache.set(cacheKey, response, 30);
      
      return res.status(StatusCodes.OK).json({
        success: true,
        cached: false,
        ...response
      });
    }

    // Format response with patient details, condition, ETA, ambulance ID
    const formattedPatients = incomingRides.map(ride => {
      const eta = ride.destinationHospital?.estimatedArrival || 
                 new Date(Date.now() + 30 * 60000); // Default 30 min ETA

      const timeToArrival = Math.max(0, Math.floor((eta - new Date()) / 60000));

      return {
        id: ride._id,
        ambulanceId: `AMB-${ride._id.toString().slice(-6).toUpperCase()}`,
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
        timeToArrival: timeToArrival,
        ambulance: {
          type: (ride.vehicle || 'standard').toUpperCase(),
          status: ride.status,
          driver: ride.rider ? {
            name: ride.rider.name || ride.rider.user?.name || 'Driver',
            phone: ride.rider.phone || ride.rider.user?.phone || null
          } : null,
          currentLocation: ride.liveTracking?.currentLocation || null
        },
        pickup: {
          address: ride.pickup?.address || 'Unknown location',
          coordinates: ride.pickup?.coordinates || null
        },
        createdAt: ride.createdAt,
        estimatedDistance: ride.distance || 0,
        status: ride.status
      };
    });

    const response = {
      count: formattedPatients.length,
      patients: formattedPatients,
      lastUpdated: new Date()
    };

    // Cache for 1 minute (real-time data needs frequent updates)
    cache.set(cacheKey, response, 60);

    res.status(StatusCodes.OK).json({
      success: true,
      cached: false,
      ...response
    });

  } catch (error) {
    console.error(`Incoming patients error for hospital ${req.user.hospitalId}:`, error.message);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: "Failed to load incoming patients. Please try again.",
      count: 0,
      patients: []
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
    const hospitalId = req.user.hospitalId;
    const { bedDetails, totalBeds, availableBeds } = req.body;

    // Additional server-side validation
    const calculatedTotal = bedDetails.icu.total + bedDetails.general.total + bedDetails.emergency.total;
    const calculatedAvailable = bedDetails.icu.available + bedDetails.general.available + bedDetails.emergency.available;

    if (totalBeds && totalBeds !== calculatedTotal) {
      throw new BadRequestError("Total beds count doesn't match sum of individual bed types");
    }

    if (availableBeds && availableBeds !== calculatedAvailable) {
      throw new BadRequestError("Available beds count doesn't match sum of available beds by type");
    }

    const updateData = {
      'bedDetails.icu.total': bedDetails.icu.total,
      'bedDetails.icu.available': bedDetails.icu.available,
      'bedDetails.general.total': bedDetails.general.total,
      'bedDetails.general.available': bedDetails.general.available,
      'bedDetails.emergency.total': bedDetails.emergency.total,
      'bedDetails.emergency.available': bedDetails.emergency.available,
      totalBeds: calculatedTotal,
      availableBeds: calculatedAvailable,
      lastUpdated: new Date()
    };

    const updatedHospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      updateData,
      { 
        new: true,
        runValidators: true,
        select: 'name bedDetails totalBeds availableBeds lastUpdated'
      }
    );

    if (!updatedHospital) {
      throw new BadRequestError("Hospital not found");
    }

    // Clear related cache
    const cacheKeys = [
      `dashboard-${hospitalId}`,
      `bed-availability-${hospitalId}`
    ];
    cacheKeys.forEach(key => cache.del(key));

    // Log bed update for audit
    console.log(`Bed availability updated for hospital ${hospitalId} by staff ${req.user.email} at ${new Date()}`);

    // Emit real-time update to all connected clients (if WebSocket is configured)
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
    console.error(`Bed update error for hospital ${req.user.hospitalId}:`, error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message
    });
  }
};

// 6. Get Current Bed Availability
export const getBedAvailability = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId;
    const cacheKey = `bed-availability-${hospitalId}`;
    
    // Try cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(StatusCodes.OK).json({
        success: true,
        cached: true,
        ...cached
      });
    }

    const hospital = await Hospital.findById(hospitalId)
      .select('name bedDetails totalBeds availableBeds lastUpdated');

    if (!hospital) {
      throw new BadRequestError("Hospital not found");
    }

    // Ensure bed details exist with defaults
    const bedDetails = hospital.bedDetails || {
      icu: { total: 0, available: 0 },
      general: { total: 0, available: 0 },
      emergency: { total: 0, available: 0 }
    };

    const response = {
      hospital: {
        id: hospital._id,
        name: hospital.name,
        bedDetails: bedDetails,
        totalBeds: hospital.totalBeds || 0,
        availableBeds: hospital.availableBeds || 0,
        lastUpdated: hospital.lastUpdated || hospital.updatedAt,
        occupancyRate: hospital.totalBeds > 0 ? 
          Math.round(((hospital.totalBeds - hospital.availableBeds) / hospital.totalBeds) * 100) : 0
      }
    };

    // Cache for 5 minutes
    cache.set(cacheKey, response, 300);

    res.status(StatusCodes.OK).json({
      success: true,
      cached: false,
      ...response
    });

  } catch (error) {
    console.error(`Bed availability error for hospital ${req.user.hospitalId}:`, error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: "Failed to load bed availability. Please try again."
    });
  }
};

// 7. Update Live Location for Ambulance (Called by driver app)
export const updateAmbulanceLocation = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { latitude, longitude, address, timestamp } = req.body;

    if (!rideId || !mongoose.Types.ObjectId.isValid(rideId)) {
      throw new BadRequestError("Valid ride ID is required");
    }

    const ride = await Ride.findByIdAndUpdate(
      rideId,
      {
        'liveTracking.currentLocation.latitude': latitude,
        'liveTracking.currentLocation.longitude': longitude,
        'liveTracking.currentLocation.address': address || `${latitude}, ${longitude}`,
        'liveTracking.lastUpdated': timestamp || new Date()
      },
      { 
        new: true,
        select: '_id destinationHospital liveTracking'
      }
    );

    if (!ride) {
      throw new BadRequestError("Ride not found");
    }

    // Clear related cache
    if (ride.destinationHospital?.hospitalId) {
      const hospitalId = ride.destinationHospital.hospitalId;
      const cacheKeys = [
        `incoming-patients-${hospitalId}`,
        `live-tracking-${hospitalId}`,
        `dashboard-${hospitalId}`
      ];
      cacheKeys.forEach(key => cache.del(key));
    }

    // Emit real-time location update
    if (req.io && ride.destinationHospital?.hospitalId) {
      req.io.emit('ambulanceLocationUpdate', {
        rideId: ride._id,
        ambulanceId: `AMB-${ride._id.toString().slice(-6).toUpperCase()}`,
        location: {
          latitude,
          longitude,
          address: address || `${latitude}, ${longitude}`
        },
        hospitalId: ride.destinationHospital.hospitalId,
        timestamp: timestamp || new Date()
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Location updated successfully",
      data: {
        rideId: ride._id,
        location: ride.liveTracking?.currentLocation,
        lastUpdated: ride.liveTracking?.lastUpdated
      }
    });

  } catch (error) {
    console.error(`Location update error for ride ${req.params.rideId}:`, error.message);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ 
      success: false,
      error: error.message
    });
  }
};
