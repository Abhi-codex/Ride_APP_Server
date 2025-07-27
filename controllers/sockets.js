import geolib from "geolib";
import jwt from "jsonwebtoken";
import process from "process";
import User from "../models/User.js";
import Ride from "../models/Ride.js";

const onDutyDrivers = new Map();

const handleSocketConnection = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.headers.access_token;
      if (!token) return next(new Error("Authentication invalid: No token"));

      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return next(new Error("Authentication invalid: User not found"));

      socket.user = { id: payload.id, role: user.role };
      next();
    } catch (error) {
      console.error("Socket Auth Error:", error);
      next(new Error("Authentication invalid: Token verification failed"));
    }
  });

  io.on("connection", (socket) => {
    // Doctor-Patient Chat Events
    // Join a chat room (per appointment or doctor-patient pair)
    socket.on("joinChat", ({ appointmentId, otherUserId }) => {
      if (!appointmentId && !otherUserId) {
        return socket.emit("error", { message: "Missing appointmentId or otherUserId for chat room." });
      }
      // Room name: prefer appointment-based, else user-pair
      const room = appointmentId ? `chat_${appointmentId}` : [user.id, otherUserId].sort().join(":");
      socket.join(room);
      socket.emit("joinedChat", { room });
      console.log(`User ${user.id} joined chat room ${room}`);
    });

    // Send a chat message
    socket.on("sendMessage", async ({ appointmentId, receiverId, content, type = "text" }) => {
      if (!content || !receiverId) {
        return socket.emit("error", { message: "Missing content or receiverId." });
      }
      const Message = (await import("../models/Message.js")).default;
      // Save message to DB
      const messageDoc = await Message.create({
        appointment: appointmentId,
        sender: user.id,
        receiver: receiverId,
        content,
        type,
        timestamp: new Date()
      });
      // Room name logic (match joinChat)
      const room = appointmentId ? `chat_${appointmentId}` : [user.id, receiverId].sort().join(":");
      io.to(room).emit("newMessage", {
        _id: messageDoc._id,
        appointment: appointmentId,
        sender: user.id,
        receiver: receiverId,
        content,
        type,
        timestamp: messageDoc.timestamp
      });
    });

    // Fetch chat history
    socket.on("fetchMessages", async ({ appointmentId, otherUserId, limit = 50, skip = 0 }) => {
      try {
        const Message = (await import("../models/Message.js")).default;
        let query = {};
        if (appointmentId) {
          query.appointment = appointmentId;
        } else if (otherUserId) {
          // Fetch all messages between these two users
          query.$or = [
            { sender: user.id, receiver: otherUserId },
            { sender: otherUserId, receiver: user.id }
          ];
        } else {
          return socket.emit("error", { message: "Missing appointmentId or otherUserId for chat history." });
        }
        const messages = await Message.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
        socket.emit("chatHistory", messages.reverse());
      } catch (err) {
        console.error("Error fetching chat history:", err);
        socket.emit("error", { message: "Failed to fetch chat history" });
      }
    });
    const user = socket.user;
    console.log(`User Joined: ${user.id} (${user.role})`);

    if (user.role === "driver") {
      socket.on("goOnDuty", (coords) => {
        onDutyDrivers.set(user.id, { socketId: socket.id, coords });
        socket.join("onDuty");
        console.log(`Driver ${user.id} is now on duty.`);
        updateNearbyDrivers();
      });

      socket.on("goOffDuty", () => {
        onDutyDrivers.delete(user.id);
        socket.leave("onDuty");
        console.log(`Driver ${user.id} is now off duty.`);
        updateNearbyDrivers();
      });

      socket.on("updateLocation", (coords) => {
        if (onDutyDrivers.has(user.id)) {
          onDutyDrivers.get(user.id).coords = coords;
          console.log(`Driver ${user.id} updated location.`);
          updateNearbyDrivers();
          socket.to(`driver_${user.id}`).emit("driverLocationUpdate", {
            driverId: user.id,
            coords,
          });
        }
      });
    }

    if (user.role === "patient") {
      socket.on("subscribeToZone", (patientCoords) => {
        socket.user.coords = patientCoords;
        sendNearbyDrivers(socket, patientCoords);
      });

      socket.on("searchDriver", async (rideId) => {
        try {
          const ride = await Ride.findById(rideId).populate("customer rider");
          if (!ride) return socket.emit("error", { message: "Emergency call not found" });

          const { latitude: pickupLat, longitude: pickupLon } = ride.pickup;

          let retries = 0;
          let rideAccepted = false;
          let canceled = false;
          const MAX_RETRIES = 20;

          const retrySearch = async () => {
            if (canceled) return;
            retries++;

            const drivers = sendNearbyDrivers(socket, { latitude: pickupLat, longitude: pickupLon }, ride);
            if (drivers.length > 0 || retries >= MAX_RETRIES) {
              clearInterval(retryInterval);
              if (!rideAccepted && retries >= MAX_RETRIES) {
                await Ride.findByIdAndDelete(rideId);
                socket.emit("error", { message: "No ambulance drivers found within 5 minutes." });
              }
            }
          };

          const retryInterval = setInterval(retrySearch, 10000);

          socket.on("rideAccepted", () => {
            rideAccepted = true;
            clearInterval(retryInterval);
          });

          socket.on("cancelRide", async () => {
            canceled = true;
            clearInterval(retryInterval);
            await Ride.findByIdAndDelete(rideId);
            socket.emit("rideCanceled", { message: "Emergency call canceled" });

            if (ride.rider) {
              const driverSocket = getDriverSocket(ride.rider._id);
              driverSocket?.emit("rideCanceled", { message: `Patient ${user.id} canceled the emergency call.` });
            }
            console.log(`Patient ${user.id} canceled emergency call ${rideId}`);
          });
        } catch (error) {
          console.error("Error searching for ambulance driver:", error);
          socket.emit("error", { message: "Error searching for ambulance driver" });
        }
      });
    }

    socket.on("subscribeToDriverLocation", (driverId) => {
      const driver = onDutyDrivers.get(driverId);
      if (driver) {
        socket.join(`driver_${driverId}`);
        socket.emit("driverLocationUpdate", { driverId, coords: driver.coords });
        console.log(`User ${user.id} subscribed to driver ${driverId}'s location.`);
      }
    });

    socket.on("subscribeRide", async (rideId) => {
      socket.join(`ride_${rideId}`);
      try {
        const rideData = await Ride.findById(rideId).populate("customer rider");
        socket.emit("rideData", rideData);
      } catch (error) {
        console.error("Failed to receive emergency call data:", error);
        socket.emit("error", { message: "Failed to receive emergency call data" });
      }
    });

    socket.on("disconnect", () => {
      if (user.role === "driver") onDutyDrivers.delete(user.id);
      console.log(`${user.role} ${user.id} disconnected.`);
    });

    function updateNearbyDrivers() {
      io.sockets.sockets.forEach((socket) => {
        if (socket.user?.role === "patient") {
          const patientCoords = socket.user.coords;
          if (patientCoords) sendNearbyDrivers(socket, patientCoords);
        }
      });
    }

    function sendNearbyDrivers(socket, location, ride = null) {
      const nearbyDrivers = Array.from(onDutyDrivers.values())
        .map((driver) => ({
          ...driver,
          distance: geolib.getDistance(driver.coords, location),
        }))
        .filter((driver) => driver.distance <= 60000)
        .sort((a, b) => a.distance - b.distance);

      socket.emit("nearbyDrivers", nearbyDrivers);

      if (ride) {
        nearbyDrivers.forEach((driver) => {
          io.to(driver.socketId).emit("emergencyCall", ride);
        });
      }

      return nearbyDrivers;
    }

    function getDriverSocket(driverId) {
      const driver = onDutyDrivers.get(driverId);
      return driver ? io.sockets.sockets.get(driver.socketId) : null;
    }
  });
};

export default handleSocketConnection;
