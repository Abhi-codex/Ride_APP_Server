import dotenv from 'dotenv';
import 'express-async-errors';
import EventEmitter from 'events';
import express from 'express';
import http from 'http';
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
  try {
    await connectDB(process.env.MONGO_URI);
    console.log('Database connected successfully');
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`HTTP server is running on port http://localhost:${PORT}`);
      console.log(`Server is accessible from network at http://192.168.31.49:${PORT}`);
      console.log('Available endpoints:');
      console.log(`  - POST http://192.168.31.49:${PORT}/auth/signin`);
      console.log(`  - POST http://192.168.31.49:${PORT}/auth/signup`);
      console.log(`  - GET  http://192.168.31.49:${PORT}/health`);
      console.log(`  - Ride endpoints require authentication`);
    });
  } catch (error) {
    console.log('Error starting server:', error);
  }
};

start();
