const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use('/uploads', express.static('uploads'));
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' })); // Restrict CORS in production
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
    console.log('Connected to MongoDB successfully!');

    const db = client.db(process.env.DB_NAME);

    // Set collection for routes
    userRoute.setCollection(db, admin);
    totalProjectsRoute.setCollection(db);

    // Use routes
    app.use('/users', userRoute.router);
    app.use('/total-projects', totalProjectsRoute.router);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit process on connection failure
  }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => {
  res.send('Projukti Sheba Backend is running 🚀');
});

// Handle server shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing MongoDB connection...');
  await client.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});