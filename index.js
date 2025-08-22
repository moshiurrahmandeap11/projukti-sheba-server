const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Firebase Admin (যদি প্রয়োজন হয়)
// নিশ্চিত হয়ে নাও যে তোমার .env ফাইলে FIREBASE_SERVICE_ACCOUNT_JSON সঠিকভাবে সেট করা আছে
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.warn("Firebase Admin SDK শুরু করা যায়নি। FIREBASE_SERVICE_ACCOUNT_JSON চেক করুন।");
}


// Middleware
// Vercel-এর জন্য '/uploads' স্ট্যাটিক্যালি সার্ভ করা কাজ করবে না। 
// ফাইল আপলোডের জন্য ক্লাউড স্টোরেজ (যেমন Cloudinary, AWS S3) ব্যবহার করা ভালো।
// app.use('/uploads', express.static('uploads')); 
app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
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

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');
    const db = client.db(process.env.DB_NAME);

    // কালেকশনগুলো এখানে 정의 করা যেতে পারে যদি প্রয়োজন হয়
    const usersCollection = db.collection('users');
    const projectsCollection = db.collection('projects'); // অনুমান করছি তোমার একটি 'projects' কালেকশন আছে

    // Use routes (নতুন পদ্ধতিতে)
    // সরাসরি রাউট ফাইল require করে তার মধ্যে db বা কালেকশন পাস করে দেওয়া হচ্ছে
    app.use('/api/users', require('./api/users')(usersCollection, admin));
    // app.use('/api/total-projects', require('./api/totalProjects')(projectsCollection)); // totalProjects রাউটের জন্য একই প্যাটার্ন

  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
  }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => {
  res.send('Projukti Sheba Backend is running 🚀');
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// SIGTERM হ্যান্ডলিং লোকাল ডেভেলপমেন্টের জন্য ঠিক আছে, কিন্তু সার্ভারলেস পরিবেশে এর প্রয়োজন নেই
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing MongoDB connection...');
  await client.close();
  process.exit(0);
});

module.exports = app; // Vercel-এর জন্য app এক্সপোর্ট করা ভালো অভ্যাস