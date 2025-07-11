import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["patient", "driver"],
      required: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    // Hospital affiliation details for drivers
    hospitalAffiliation: {
      isAffiliated: {
        type: Boolean,
        default: false,
      },
      hospitalName: {
        type: String,
        default: null,
      },
      hospitalId: {
        type: String,
        default: null,
      },
      hospitalAddress: {
        type: String,
        default: null,
      },
      employeeId: {
        type: String,
        default: null,
      },
      // If affiliated, hospital's fare formula will be used
      customFareFormula: {
        baseFare: {
          type: Number,
          default: null,
        },
        perKmRate: {
          type: Number,
          default: null,
        },
        minimumFare: {
          type: Number,
          default: null,
        },
      },
    },
    vehicle: {
      type: {
        type: String,
        enum: ["bls", "als", "ccs", "auto", "bike"],
        default: null,
      },
      plateNumber: {
        type: String,
        default: null,
      },
      model: {
        type: String,
        default: null,
      },
      licenseNumber: {
        type: String,
        default: null,
      },
      certificationLevel: {
        type: String,
        enum: ["EMT-Basic", "EMT-Intermediate", "EMT-Paramedic", "Critical Care"],
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.createAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      phone: this.phone,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.createRefreshToken = function () {
  return jwt.sign(
    { id: this._id, phone: this.phone },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

const User = mongoose.model("User", userSchema);
export default User;
