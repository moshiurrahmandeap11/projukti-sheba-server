const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use('/uploads', express.static('uploads'));
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.temrfiu.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// import routes
const userRoute = require('./routes/users');

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");

    const db = client.db(process.env.DB_NAME);

    // set collection for users
    userRoute.setCollection(db);

    // use users route
    app.use("/users", userRoute.router);

  } catch (err) {
    console.error(err);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Projukti Sheba Backend is running 🚀");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
