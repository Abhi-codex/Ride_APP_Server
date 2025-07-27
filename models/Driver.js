import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  vehicle: {
    type: { type: String, enum: ["bls", "als", "ccs", "auto", "bike"], required: false },
    plateNumber: { type: String, required: false },
    model: { type: String },
    licenseNumber: { type: String },
    certificationLevel: {
      type: String,
      enum: ["EMT-Basic", "EMT-Intermediate", "EMT-Paramedic", "Critical Care"],
      default: null,
    },
    specializations: [
      {
        type: String,
        enum: ["cardiac", "trauma", "respiratory", "neurological", "pediatric", "obstetric", "psychiatric", "burns", "poisoning", "general"],
      },
    ],
  },
  hospitalAffiliation: {
    isAffiliated: { type: Boolean, default: false },
    hospitalName: { type: String, default: null },
    hospitalId: { type: String, default: null },
    hospitalAddress: { type: String, default: null },
    employeeId: { type: String, default: null },
    customFareFormula: {
      baseFare: { type: Number, default: null },
      perKmRate: { type: Number, default: null },
      minimumFare: { type: Number, default: null },
    },
  },
  isOnline: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Driver", DriverSchema);
