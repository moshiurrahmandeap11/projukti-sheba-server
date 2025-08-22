const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin only if the config is available
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized successfully.');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error.message);
  }
} else {
  console.warn('FIREBASE_SERVICE_ACCOUNT_JSON not found. Firebase Admin not initialized.');
}


// Middleware
// Note: express.static will not work for 'uploads' on Vercel's ephemeral file system.
// Consider using a cloud storage service like Vercel Blob, AWS S3, or Cloudinary.
// app.use('/uploads', express.static('uploads')); 
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
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

// We create a single promise for the connection to reuse it
let dbConnectionPromise = null;

async function getDb() {
  if (!dbConnectionPromise) {
    dbConnectionPromise = client.connect()
      .then(() => {
        console.log('Connected to MongoDB successfully!');
        return client.db(process.env.DB_NAME);
      })
      .catch(err => {
        console.error('MongoDB connection error:', err.message);
        dbConnectionPromise = null; // Reset promise on error to allow retries
        throw err; // Re-throw error to be caught by callers
      });
  }
  return dbConnectionPromise;
}

// Import routes
const userRoute = require('./api/users');
const totalProjectsRoute = require('./api/totalProjects');

// Middleware to attach DB to requests
// This ensures that the DB is connected before any route logic runs
const dbMiddleware = async (req, res, next) => {
  try {
    const db = await getDb();
    req.db = db; // Attach db instance to request object
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to connect to the database' });
  }
};

// Apply the middleware to all routes that need a DB connection
app.use('/api', dbMiddleware, (req, res, next) => {
    // Pass the db instance and admin to the route modules
    userRoute.setCollection(req.db, admin);
    totalProjectsRoute.setCollection(req.db);
    next();
});


// Use routes (now they are guaranteed to have a DB connection)
app.use('/api/users', userRoute.router);
app.use('/api/total-projects', totalProjectsRoute.router);


// Root route (works without DB)
app.get('/', (req, res) => {
  res.send('Projukti Sheba Backend is running 🚀');
});


// Start the server
// This is required for platforms like Render (Web Services) and for local development.
// Serverless platforms like Vercel will ignore this and use the exported app.
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Export the app for serverless platforms
module.exports = app;
