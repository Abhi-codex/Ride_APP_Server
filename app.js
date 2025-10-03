import dotenv from 'dotenv';
import 'express-async-errors';
import EventEmitter from 'events';
import express from 'express';
import cors from 'cors';
import http from 'http';
import mongoose from 'mongoose';
import process from 'process';
import { Server as socketIo } from 'socket.io'; 
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import connectDB from './config/connect.js';
import notFoundMiddleware from './middleware/not-found.js';
import errorHandlerMiddleware from './middleware/error-handler.js';
import os from 'os';

import authRouter from './routes/auth.js';
import rideRouter from './routes/ride.js';
import driverRouter from './routes/driver.js';
import hospitalRouter from './routes/hospital.js';
import hospitalDashboardRouter from './routes/hospitalDashboard.js';
import messageRouter from './routes/message.js';
import doctorRouter from './routes/doctor.js';
import patientRouter from './routes/patient.js';

import handleSocketConnection from './controllers/sockets.js';

dotenv.config();

// Debug environment variables
console.log('DEBUG: Environment variables loaded');
console.log('DEBUG: JWT_SECRET configured:', !!process.env.JWT_SECRET);

EventEmitter.defaultMaxListeners = 20;

const app = express();
app.use(cors());
// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// MongoDB injection protection
app.use(mongoSanitize());

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://ambulancebackend.onrender.com'] // Production domains
    : ['http://localhost:3000', 'http://localhost:3001'];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${clientIP}`);
  next();
});

const server = http.createServer(app);

const io = new socketIo(server, { 
  cors: { 
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://ambulancebackend.onrender.com'] // Production domain
      : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true
  } 
});

console.log('DEBUG: Socket.IO instance created:', !!io);
console.log('DEBUG: Socket.IO type:', typeof io);

app.use((req, res, next) => {
  req.io = io;
  console.log('DEBUG: Attaching io to req. io exists:', !!io, 'io.to exists:', !!(io && io.to));
  return next();
});

handleSocketConnection(io);

// REST API for chat/messages
app.use('/messages', messageRouter);

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
app.use("/ride", rideRouter);
app.use("/driver", driverRouter);
app.use("/hospitals", hospitalRouter);
app.use("/hospital-dashboard", hospitalDashboardRouter);
app.use("/doctor", doctorRouter);
app.use("/patient", patientRouter);

// Middleware
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const start = async () => {
  const PORT = process.env.PORT || 3000;
  const localIp = getLocalIp();
  // eslint-disable-next-line no-unused-vars
  const server_instance = server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Service Server running on http://localhost:${PORT}`);
    console.log(`🌐 Network access: http://${localIp}:${PORT}`);
    console.log(`📍 Health check: http://${localIp}:${PORT}/health`);
    console.log(`🔐 Auth profiles: http://${localIp}:${PORT}/auth/*`);
    console.log(`🏥 Hospital search: http://${localIp}:${PORT}/hospitals/*`);
    console.log(`🚨 Emergency calls: http://${localIp}:${PORT}/ride/*`);
    console.log(`👨‍⚕️ Driver endpoints: http://${localIp}:${PORT}/driver/*`);
    console.log(`🏥 Patient profiles: http://${localIp}:${PORT}/patient/*`);
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
