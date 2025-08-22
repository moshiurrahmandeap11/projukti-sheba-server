const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use('/uploads', express.static('uploads')); // Note: This won't work on Vercel; consider removing or handling differently
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit to 100 requests per window
}));

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.temrfiu.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Import routes
const userRoute = require('./api/users');
const totalProjectsRoute = require('./api/totalProjects');

async function run() {
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB successfully! DB:', process.env.DB_NAME);
    const db = client.db(process.env.DB_NAME);

    // Set collection for routes
    userRoute.setCollection(db, admin);
    totalProjectsRoute.setCollection(db);

    // Use routes
    app.use('/api/users', userRoute.router);
    app.use('/api/total-projects', totalProjectsRoute.router);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Do not exit; log error and continue with unmounted routes if needed
  }
}

run().catch(console.dir);

// Root route (works without DB)
app.get('/', (req, res) => {
  res.send('Projukti Sheba Backend is running 🚀');
});

// Handle server shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing MongoDB connection...');
  await client.close();
  process.exit(0);
});

// Start server without waiting for DB (Vercel will handle retries)
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});