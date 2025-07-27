import mongoose from 'mongoose';
import Ride from '../models/Ride.js';
import User from '../models/User.js';
import Driver from '../models/Driver.js';

export const calculateDriverStats = async (riderId) => {
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const statsAggregation = [
    { $match: { rider: new mongoose.Types.ObjectId(riderId), status: 'COMPLETED' }},
    { $facet: { totalRides: [{ $count: "count" }],
        todayData: [{ $match: {createdAt: { $gte: today }}},
                    { $group: {_id: null, rides: { $sum: 1 }, earnings: { $sum: "$fare" }}}
                   ],
        weeklyData: [{ $match: {createdAt: { $gte: weekStart }}},
                     { $group: { _id: null, rides: { $sum: 1 }, earnings: { $sum: "$fare" }}}
                    ],
        monthlyData: [{ $match: {createdAt: { $gte: monthStart }}},
                      { $group: { _id: null, earnings: { $sum: "$fare" }}}
                     ],
        ratingData: [{ $match: {rating: { $exists: true, $ne: null, $gte: 1 }}},
                     { $group: {_id: null, averageRating: { $avg: "$rating" }, totalRatings: { $sum: 1 }}}
                    ]
              }
    }
  ];

  const result = await Ride.aggregate(statsAggregation);
  const data = result[0];

  return {
    totalRides: data.totalRides[0]?.count || 0,
    todayRides: data.todayData[0]?.rides || 0,
    todayEarnings: Math.round(data.todayData[0]?.earnings || 0),
    weeklyRides: data.weeklyData[0]?.rides || 0,
    weeklyEarnings: Math.round(data.weeklyData[0]?.earnings || 0),
    monthlyEarnings: Math.round(data.monthlyData[0]?.earnings || 0),
    rating: data.ratingData[0]?.averageRating ? 
      Math.round(data.ratingData[0].averageRating * 10) / 10 : 0
  };
};

export const getDriverStats = async (req, res) => {
  try {
    const riderId = req.user.id;
    const stats = await calculateDriverStats(riderId);

    // Find available ride requests for this driver
    const driver = await Driver.findOne({ user: riderId });
    let availableRides = [];
    let needsProfileCompletion = false;
    if (driver && driver.vehicle && driver.vehicle.type) {
      // Only show rides created within the last 10 minutes and matching ambulance type
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      availableRides = await Ride.find({
        status: "SEARCHING_FOR_RIDER",
        vehicle: driver.vehicle.type,
        createdAt: { $gte: tenMinutesAgo }
      })
      .populate("customer", "phone name")
      .sort({ createdAt: -1 })
      .select("_id vehicle pickup drop emergency customer createdAt");
    } else {
      needsProfileCompletion = true;
    }

    console.log('Driver stats calculated:', stats);

    res.json({
      success: true,
      data: {
        ...stats,
        availableRides,
        needsProfileCompletion
      }
    });

  } catch (error) {
    console.error('Error fetching driver stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver statistics',
      error: error.message
    });
  }
};

export const getDriverProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-__v').lean();
    if (!user || user.role !== 'driver') {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    const driver = await Driver.findOne({ user: userId }).lean();
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }
    const profileData = {
      _id: user._id,
      name: user.name || 'Driver',
      email: user.email,
      phone: user.phone,
      role: user.role,
      isOnline: driver.isOnline || false,
      vehicle: driver.vehicle || null,
      hospitalAffiliation: driver.hospitalAffiliation || null,
      createdAt: user.createdAt
    };
    res.json({ success: true, data: profileData });
  } catch (error) {
    console.error('Error fetching driver profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch driver profile', error: error.message });
  }
};

export const updateOnlineStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { isOnline } = req.body;
    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isOnline must be a boolean value' });
    }
    const driver = await Driver.findOneAndUpdate(
      { user: userId },
      { isOnline },
      { new: true, select: 'isOnline' }
    );
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    if (req.io) {
      req.io.emit('driverStatusUpdate', { userId, isOnline: driver.isOnline });
    }
    res.json({ success: true, message: `Driver is now ${isOnline ? 'online' : 'offline'}`, data: { isOnline: driver.isOnline } });
  } catch (error) {
    console.error('Error updating online status:', error);
    res.status(500).json({ success: false, message: 'Failed to update online status', error: error.message });
  }
};

export const updateVehicleInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, plateNumber, model, licenseNumber, certificationLevel, specializations } = req.body;
    // Use Driver model enums
    const validTypes = ["bls", "als", "ccs", "auto", "bike"];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid ambulance type. Valid types: bls, als, ccs, auto, bike' });
    }
    const validCertifications = ["EMT-Basic", "EMT-Intermediate", "EMT-Paramedic", "Critical Care"];
    if (certificationLevel && !validCertifications.includes(certificationLevel)) {
      return res.status(400).json({ success: false, message: 'Invalid certification level. Valid levels: EMT-Basic, EMT-Intermediate, EMT-Paramedic, Critical Care' });
    }
    const updateData = {};
    if (type) updateData['vehicle.type'] = type;
    if (plateNumber) updateData['vehicle.plateNumber'] = plateNumber;
    if (model) updateData['vehicle.model'] = model;
    if (licenseNumber) updateData['vehicle.licenseNumber'] = licenseNumber;
    if (certificationLevel) updateData['vehicle.certificationLevel'] = certificationLevel;
    if (specializations) updateData['vehicle.specializations'] = specializations;
    const updatedDriver = await Driver.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, select: 'vehicle' }
    );
    if (!updatedDriver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    res.json({ success: true, message: 'Ambulance information updated successfully', data: { vehicle: updatedDriver.vehicle } });
  } catch (error) {
    console.error('Error updating ambulance information:', error);
    res.status(500).json({ success: false, message: 'Failed to update ambulance information', error: error.message });
  }
};

export const getRideHistory = async (req, res) => {
  try {
    const riderId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const rides = await Ride.find({ rider: riderId })
      .populate('customer', 'phone name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');

    const totalRides = await Ride.countDocuments({ rider: riderId });

    res.json({
      success: true,
      data: {
        rides,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRides / limit),
          totalRides,
          hasNextPage: page < Math.ceil(totalRides / limit),
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching ride history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ride history',
      error: error.message
    });
  }
};
