import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    role: { type: String, enum: ["patient", "driver", "doctor"], required: true },
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: null },
    email: { type: String, default: null },
    isOnline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Method to create JWT refresh token
userSchema.methods.createRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      phone: this.phone,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

// Virtual to populate doctor profile if user is a doctor
userSchema.virtual("doctorProfile", {
  ref: "Doctor",
  localField: "_id",
  foreignField: "user",
  justOne: true,
});

// Method to create JWT access token
userSchema.methods.createAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      phone: this.phone,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

const User = mongoose.model("User", userSchema);
export default User;
