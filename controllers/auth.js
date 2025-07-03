import User from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { BadRequestError, UnauthenticatedError } from "../errors/index.js";
import jwt from "jsonwebtoken";

export const auth = async (req, res) => {
  const { phone, role } = req.body;

  if (!phone) {
    throw new BadRequestError("Phone number is required");
  }

  if (!role || !["patient", "driver"].includes(role)) {
    throw new BadRequestError("Valid role is required (patient or driver)");
  }

  try {
    let user = await User.findOne({ phone });

    if (user) {
      if (user.role !== role) {
        throw new BadRequestError("Phone number and role do not match");
      }

      const accessToken = user.createAccessToken();
      const refreshToken = user.createRefreshToken();

      return res.status(StatusCodes.OK).json({
        message: "User logged in successfully",
        user,
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    user = new User({
      phone,
      role,
    });

    await user.save();

    const accessToken = user.createAccessToken();
    const refreshToken = user.createRefreshToken();

    res.status(StatusCodes.CREATED).json({
      message: "User created successfully",
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    throw new BadRequestError("Refresh token is required");
  }

  try {
    const payload = jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(payload.id);

    if (!user) {
      throw new UnauthenticatedError("Invalid refresh token");
    }

    const newAccessToken = user.createAccessToken();
    const newRefreshToken = user.createRefreshToken();

    res.status(StatusCodes.OK).json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error) {
    console.error(error);
    throw new UnauthenticatedError("Invalid refresh token");
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, vehicle } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      throw new BadRequestError("User not found");
    }

    // Prepare update data
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Handle vehicle information for drivers
    if (user.role === "driver" && vehicle) {
      const { type, plateNumber, model, licenseNumber, certificationLevel } = vehicle;

      // Validate ambulance type
      const validTypes = ["basicAmbulance", "advancedAmbulance", "icuAmbulance", "airAmbulance"];
      if (type && !validTypes.includes(type)) {
        throw new BadRequestError(
          "Invalid ambulance type. Valid types: basicAmbulance, advancedAmbulance, icuAmbulance, airAmbulance"
        );
      }

      // Validate certification level
      const validCertifications = ["EMT-Basic", "EMT-Intermediate", "EMT-Paramedic", "Critical Care"];
      if (certificationLevel && !validCertifications.includes(certificationLevel)) {
        throw new BadRequestError(
          "Invalid certification level. Valid levels: EMT-Basic, EMT-Intermediate, EMT-Paramedic, Critical Care"
        );
      }

      // Update vehicle information
      if (type) updateData["vehicle.type"] = type;
      if (plateNumber) updateData["vehicle.plateNumber"] = plateNumber;
      if (model) updateData["vehicle.model"] = model;
      if (licenseNumber) updateData["vehicle.licenseNumber"] = licenseNumber;
      if (certificationLevel) updateData["vehicle.certificationLevel"] = certificationLevel;
    }

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, select: "-__v" }
    );

    res.status(StatusCodes.OK).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};

// Get user profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("-__v");
    if (!user) {
      throw new BadRequestError("User not found");
    }

    res.status(StatusCodes.OK).json({
      message: "Profile retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Error retrieving profile:", error);
    throw error;
  }
};
