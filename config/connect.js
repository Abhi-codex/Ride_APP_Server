import mongoose from "mongoose";

const connectDB = async (url) => {
  try {
    const options = {
      serverSelectionTimeoutMS: 30000, 
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 300000,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: true,
      w: "majority",
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
  }  catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    
    if (error.name === 'MongoServerSelectionError') {
      console.error("⚠️ Could not connect to any MongoDB server in the replica set. Please check:");
      console.error("   - Your network connection");
      console.error("   - MongoDB Atlas service status");
      console.error("   - IP whitelist settings in MongoDB Atlas");
    }
    
    console.log("🔄 Will retry MongoDB connection in background...");


    return new Promise((_, reject) => {
      setTimeout(() => {
        console.log("🔄 Retrying MongoDB connection...");
        connectDB(url).then(
          conn => mongoose.connection.emit("reconnected", conn),
          err => console.error("❌ Retry failed:", err.message)
        );
      }, 15000);
      
      reject(error);
    });
  }
};

export default connectDB;
