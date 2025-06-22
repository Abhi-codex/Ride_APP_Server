import express from 'express';

const app = express();
const PORT = 3000;

// Enable CORS
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

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip} (${req.get('User-Agent')})`);
  next();
});

// Test endpoints
app.get('/health', (req, res) => {
  console.log('Health check accessed');
  res.json({ 
    status: 'OK', 
    message: 'Simple test server is running',
    timestamp: new Date().toISOString(),
    from: req.ip
  });
});

app.post('/auth/signin', (req, res) => {
  console.log('Signin endpoint accessed with body:', req.body);
  res.json({
    message: 'Test signin endpoint working',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Network access: http://192.168.31.49:${PORT}`);
  console.log('Test endpoints:');
  console.log(`  GET  http://192.168.31.49:${PORT}/health`);
  console.log(`  POST http://192.168.31.49:${PORT}/auth/signin`);
});
