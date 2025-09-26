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

    // Join user-specific room for notifications
    socket.join(`user_${user.id}`);
    console.log(`User ${user.id} joined user room: user_${user.id}`);

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

      // Driver cancellation event
      socket.on("driverCancelRide", async ({ rideId, reason }) => {
        try {
          if (!rideId) {
            return socket.emit("error", { message: "Ride ID is required for cancellation" });
          }

          const ride = await Ride.findById(rideId).populate('customer rider');
          if (!ride) {
            return socket.emit("error", { message: "Ride not found" });
          }

          // Verify this driver is assigned to the ride
          if (!ride.rider || ride.rider._id.toString() !== user.id) {
            return socket.emit("error", { message: "You are not assigned to this ride" });
          }

          // Check if ride can be cancelled by driver
          const cancellableStatuses = ['START', 'ARRIVED'];
          if (!cancellableStatuses.includes(ride.status)) {
            return socket.emit("error", { 
              message: `Ride cannot be cancelled. Current status: ${ride.status}` 
            });
          }

          // Update ride status to CANCELLED
          const updatedRide = await Ride.findByIdAndUpdate(
            rideId, 
            {
              status: 'CANCELLED',
              cancellation: {
                cancelledBy: 'driver',
                cancelledAt: new Date(),
                cancelReason: reason || 'Cancelled by driver',
                cancellationFee: 0 // No fee charged to patient for driver cancellation
              }
            },
            { new: true }
          ).populate('customer rider');

          if (updatedRide) {
            // Notify driver of successful cancellation
            socket.emit("rideCancelledSuccess", {
              message: "Ride cancelled successfully",
              rideId: rideId,
              status: 'CANCELLED',
              cancellationDetails: updatedRide.cancellation
            });

            // Notify patient about driver cancellation
            io.to(`user_${updatedRide.customer._id}`).emit("rideCancelledByDriver", {
              message: "Driver has cancelled your ride. Finding you another ambulance...",
              rideId: rideId,
              status: 'CANCELLED',
              cancellationDetails: updatedRide.cancellation
            });

            // Broadcast to ride room
            io.to(`ride_${rideId}`).emit("rideUpdate", {
              rideId: rideId,
              status: 'CANCELLED',
              cancellationDetails: updatedRide.cancellation,
              message: "Ride cancelled by driver"
            });

            console.log(`Driver ${user.id} cancelled ride ${rideId}: ${reason || 'No reason provided'}`);
          } else {
            socket.emit("error", { message: "Failed to cancel ride" });
          }
        } catch (error) {
          console.error(`Error in driver cancel ride:`, error);
          socket.emit("error", { message: "Failed to cancel ride" });
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
            
            try {
              // Update ride status to CANCELLED instead of deleting
              const updatedRide = await Ride.findByIdAndUpdate(
                rideId, 
                {
                  status: 'CANCELLED',
                  cancellation: {
                    cancelledBy: 'patient',
                    cancelledAt: new Date(),
                    cancelReason: 'Cancelled by patient during search',
                    cancellationFee: 0 // No fee during search phase
                  }
                },
                { new: true }
              ).populate('customer rider');

              if (updatedRide) {
                // Emit cancellation event to all parties
                socket.emit("rideCanceled", { 
                  message: "Emergency call canceled",
                  rideId: rideId,
                  status: 'CANCELLED',
                  cancellationDetails: updatedRide.cancellation
                });

                // Notify driver if assigned
                if (updatedRide.rider) {
                  const driverSocket = getDriverSocket(updatedRide.rider._id);
                  driverSocket?.emit("rideCanceled", { 
                    message: `Patient canceled the emergency call to ${updatedRide.drop.address}`,
                    rideId: rideId,
                    status: 'CANCELLED',
                    cancellationDetails: updatedRide.cancellation
                  });
                }

                // Broadcast to ride room for real-time updates
                io.to(`ride_${rideId}`).emit("rideUpdate", {
                  rideId: rideId,
                  status: 'CANCELLED',
                  cancellationDetails: updatedRide.cancellation,
                  message: "Ride has been cancelled"
                });

                console.log(`Patient ${user.id} canceled emergency call ${rideId} - Status updated to CANCELLED`);
              } else {
                console.error(`Failed to update ride ${rideId} status to CANCELLED`);
                socket.emit("error", { message: "Failed to cancel ride properly" });
              }
            } catch (error) {
              console.error(`Error canceling ride ${rideId}:`, error);
              socket.emit("error", { message: "Failed to cancel emergency call" });
            }
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
