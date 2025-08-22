import mongoose from "mongoose";

const HospitalStaffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  role: { 
    type: String, 
    enum: ["admin", "manager", "coordinator", "staff"], 
    default: "staff" 
  },
  department: { 
    type: String, 
    enum: ["emergency", "administration", "operations", "logistics"], 
    default: "emergency" 
  },
  permissions: {
    viewDashboard: { type: Boolean, default: true },
    manageDrivers: { type: Boolean, default: false },
    viewRides: { type: Boolean, default: true },
    manageHospitalInfo: { type: Boolean, default: false },
    viewAnalytics: { type: Boolean, default: true }
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for faster queries
HospitalStaffSchema.index({ hospitalId: 1, isActive: 1 });
HospitalStaffSchema.index({ email: 1 });

export default mongoose.model("HospitalStaff", HospitalStaffSchema);
