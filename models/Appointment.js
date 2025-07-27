import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // ISO date string (YYYY-MM-DD)
  start: { type: String, required: true }, // e.g., "14:00"
  end: { type: String, required: true },   // e.g., "14:30"
  status: {
    type: String,
    enum: ["pending", "confirmed", "rescheduled", "cancelled", "completed"],
    default: "pending"
  },
  reason: { type: String }, // Optional: reason for consultation
  notes: { type: String },  // Optional: post-consultation notes
  videoCallRoom: { type: String }, // Unique room/session ID for WebRTC
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Appointment", AppointmentSchema);
