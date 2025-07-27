import mongoose from "mongoose";

const PatientSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  medicalHistory: [{
    condition: { type: String, required: true },
    details: { type: String },
    diagnosedAt: { type: Date },
    isChronic: { type: Boolean, default: false },
  }],
  emergencyContacts: [{
    name: { type: String },
    phone: { type: String },
    relation: { type: String }
  }],
  address: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ["male", "female", "other"], default: null },
  bloodGroup: { type: String, default: null },
  allergies: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Patient", PatientSchema);
