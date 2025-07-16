import mongoose from 'mongoose';

const { Schema } = mongoose;

const rideSchema = new Schema(
  {
    vehicle: { type: String, enum: ["bls", "als", "ccs", "auto", "bike"], required: true },
    distance: { type: Number, required: true },
    pickup: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    drop: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    fare: { type: Number, required: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rider: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String,
      enum: ["SEARCHING_FOR_RIDER", "START", "ARRIVED", "COMPLETED"],
      default: "SEARCHING_FOR_RIDER",
    },
    otp: { type: String, default: null },
    rating: { type: Number, min: 1, max: 5, default: null },
    emergency: {
      type: { type: String, enum: ['cardiac', 'trauma', 'respiratory', 'neurological', 'pediatric', 
        'obstetric', 'psychiatric', 'burns', 'poisoning', 'general'], default: null },
      name: { type: String, default: null },
      priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: null },
    },
  },
  { timestamps: true }
);

const Ride = mongoose.model("Ride", rideSchema);
export default Ride;
