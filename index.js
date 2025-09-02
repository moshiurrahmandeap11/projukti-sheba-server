const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Create HTTP server for socket.io
const server = http.createServer(app);

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: "*", // Accept all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  }
});

// Middleware
app.use('/uploads', express.static('uploads')); 
app.use(cors());
app.use(express.json({ limit: '10mb' }));
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

// Global database reference
let database;

// In-memory storage for socket connections
const userSockets = new Map(); // userId -> socketId
const adminSockets = new Set(); // admin socket IDs

// Import routes
const userRoute = require('./api/users');
const totalProjectsRoute = require('./api/totalProjects');
const servicesRoute = require("./api/services");
const technogoliesRoute = require("./api/technologies");
const categoriesRoute = require("./api/categories");
const chatsRoute = require("./api/chat");
const analyticsRoute = require("./api/analytics");
const ourteamRoute = require("./api/our-team");
const contactUsRoute = require("./api/contact-us");
const contactUsSubmittedRoute = require("./api/contact-us-submitted");
const supportRoute = require("./api/support");
const testimonialsRoute = require("./api/testimonials")
const blogsRoute = require("./api/blogs")

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // User joins their personal chat room
  socket.on("joinUserChat", async (data) => {
    const { userId, userName } = data;
    
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.userName = userName;
    
    socket.join(`user_${userId}`);
    
    try {
      if (database) {
        const userChat = await database.collection("userChats").findOne({ userId });
        const messages = userChat ? userChat.messages : [];
        socket.emit("userChatHistory", messages);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      socket.emit("userChatHistory", []);
    }
  });

  // Admin joins admin room
  socket.on("joinAdmin", async () => {
    adminSockets.add(socket.id);
    socket.isAdmin = true;
    socket.join("admin_room");
    
    try {
      if (database) {
        const chats = await database.collection("userChats").find().toArray();
        
        const formattedChats = {};
        chats.forEach(chat => {
          formattedChats[chat.userId] = {
            userName: chat.userName,
            messages: chat.messages,
            lastActivity: chat.lastActivity
          };
        });
        
        socket.emit("allUserChats", formattedChats);
      }
    } catch (error) {
      console.error("Error fetching admin chats:", error);
      socket.emit("allUserChats", {});
    }
  });

  // Handle user message
  socket.on("sendUserMessage", async (messageData) => {
    const { text, userId, userName, senderType, timestamp } = messageData;
    
    const newMessage = {
      messageId: require("crypto").randomUUID(),
      text,
      senderType,
      timestamp,
      readByAdmin: false
    };

    try {
      if (database) {
        const existingChat = await database.collection("userChats").findOne({ userId });
        
        if (existingChat) {
          await database.collection("userChats").updateOne(
            { userId },
            {
              $push: { messages: newMessage },
              $set: { lastActivity: new Date() }
            }
          );
        } else {
          const newChat = {
            userId,
            userName,
            messages: [newMessage],
            createdAt: new Date(),
            lastActivity: new Date()
          };
          
          await database.collection("userChats").insertOne(newChat);
        }

        // Send to user's room
        io.to(`user_${userId}`).emit("receiveUserMessage", newMessage);
        
        // Notify all admins about new message
        io.to("admin_room").emit("newUserMessage", {
          userId,
          message: newMessage,
          userName
        });
      }
    } catch (error) {
      console.error("Error saving user message:", error);
    }
  });

  // Handle admin reply
  socket.on("sendAdminMessage", async (messageData) => {
    const { text, userId, senderType, timestamp } = messageData;
    
    const newMessage = {
      messageId: require("crypto").randomUUID(),
      text,
      senderType,
      timestamp,
      readByAdmin: true
    };

    try {
      if (database) {
        await database.collection("userChats").updateOne(
          { userId },
          {
            $push: { messages: newMessage },
            $set: { lastActivity: new Date() }
          }
        );

        // Send to user's room
        io.to(`user_${userId}`).emit("receiveUserMessage", newMessage);
        
        // Send to all admin rooms
        io.to("admin_room").emit("newUserMessage", {
          userId,
          message: newMessage
        });
      }
    } catch (error) {
      console.error("Error saving admin message:", error);
    }
  });

  // Mark messages as read by admin
  socket.on("markMessagesAsRead", async (userId) => {
    try {
      if (database) {
        await database.collection("userChats").updateOne(
          { userId },
          {
            $set: { "messages.$[elem].readByAdmin": true }
          },
          {
            arrayFilters: [{ "elem.senderType": "user" }]
          }
        );
        
        io.to("admin_room").emit("messagesMarkedRead", userId);
      }
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    
    if (socket.userId) {
      userSockets.delete(socket.userId);
    }
    
    if (socket.isAdmin) {
      adminSockets.delete(socket.id);
    }
  });
});

async function run() {
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB successfully! DB:', process.env.DB_NAME);
    
    // Set global database reference
    database = client.db(process.env.DB_NAME);

    // Set collection for routes
    userRoute.setCollection(database);
    totalProjectsRoute.setCollection(database);
    servicesRoute.setCollection(database);
    technogoliesRoute.setCollection(database);
    categoriesRoute.setCollection(database);
    chatsRoute.setCollection(database);
    ourteamRoute.setCollection(database);
    contactUsRoute.setCollection(database);
    contactUsSubmittedRoute.setCollection(database);
    supportRoute.setCollection(database);
    testimonialsRoute.setCollection(database);
    blogsRoute.setCollection(database);

    // Use routes
    app.use('/users', userRoute.router);
    app.use('/total-projects', totalProjectsRoute.router);
    app.use('/services', servicesRoute.router);
    app.use('/technologies', technogoliesRoute.router);
    app.use('/categories', categoriesRoute.router);
    app.use('/chats', chatsRoute.router);
    app.use('/analytics', analyticsRoute.router);
    app.use('/our-team', ourteamRoute.router);
    app.use('/contact-us', contactUsRoute.router);
    app.use('/contact-us-submitted', contactUsSubmittedRoute.router);
    app.use('/support', supportRoute.router);
    app.use("/testimonials", testimonialsRoute.router);
    app.use("/blogs", blogsRoute.router);

    console.log('All routes mounted successfully with Socket.IO support');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => {
  res.send('Projukti Sheba Backend is running with Socket.IO 🚀💬');
});

// Handle server shutdown gracefully
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing MongoDB connection...');  await client.close();
  process.exit(0);
});

// Start server with Socket.IO support
server.listen(port, () => {
  console.log(`Server running on port ${port} with Socket.IO support`);
});