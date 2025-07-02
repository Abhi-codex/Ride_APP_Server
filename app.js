import dotenv from 'dotenv';
import 'express-async-errors';
import EventEmitter from 'events';
import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import { Server as socketIo } from 'socket.io'; 
import connectDB from './config/connect.js';
import notFoundMiddleware from './middleware/not-found.js';
import errorHandlerMiddleware from './middleware/error-handler.js';
import authMiddleware from './middleware/authentication.js';

import authRouter from './routes/auth.js';
import rideRouter from './routes/ride.js';

import handleSocketConnection from './controllers/sockets.js';

dotenv.config();

EventEmitter.defaultMaxListeners = 20;

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip}`);
  next();
});

const server = http.createServer(app);

const io = new socketIo(server, { cors: { origin: "*" } });

app.use((req, res, next) => {
  req.io = io;
  return next();
});

handleSocketConnection(io);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.get('/db-status', (req, res) => {
  const dbStates = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };
  
  res.status(200).json({
    database: {
      status: dbStates[mongoose.connection.readyState],
      host: mongoose.connection.host || 'Unknown',
      name: mongoose.connection.name || 'Unknown'
    },
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use("/auth", authRouter);
app.use("/ride", authMiddleware, rideRouter);

// Middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const start = async () => {
  const PORT = process.env.PORT || 3000;
  const server_instance = server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🌐 Network access: http://192.168.31.49:${PORT}`);
    console.log(`📍 Health check: http://192.168.31.49:${PORT}/health`);
    console.log(`🔐 Auth endpoint: http://192.168.31.49:${PORT}/auth/signin`);
    console.log(`🚗 Ride endpoints: http://192.168.31.49:${PORT}/ride/*`);
  });

  try {
    await connectDB(process.env.MONGO_URI);
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.log('⚠️ Database connection failed:', error.message);
    console.log('🔄 Server is running without database. Database will retry connection automatically.');
  }
};

start();
