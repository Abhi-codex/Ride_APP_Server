import mongoose from "mongoose";

const connectDB = async (url) => {
  try {
    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 300000,
    };

    console.log("🔄 Attempting to connect to MongoDB...");

    const conn = await mongoose.connect(url, options);

    console.log("✅ MongoDB Connected:", conn.connection.host);

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB reconnected");
    });

    return conn;
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);

    console.log("🔄 Will retry MongoDB connection in background...");

    setTimeout(() => {
      console.log("🔄 Retrying MongoDB connection...");
      connectDB(url);
    }, 10000);

    throw error;
  }
};

export default connectDB;
