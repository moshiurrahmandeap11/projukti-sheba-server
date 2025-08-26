const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

let chatsCollection; // MongoDB collection for user chats

// setCollection function
function setCollection(db) {
  chatsCollection = db.collection("userChats");
}

// Get all user chats (for admin)
router.get("/admin/all", async (req, res) => {
  try {
    const chats = await chatsCollection.find().toArray();
    
    // Format for admin panel
    const formattedChats = {};
    chats.forEach(chat => {
      formattedChats[chat.userId] = {
        userName: chat.userName,
        messages: chat.messages,
        lastActivity: chat.lastActivity
      };
    });

    res.json({
      success: true,
      data: formattedChats,
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// Get chat history for a specific user
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const userChat = await chatsCollection.findOne({ userId });
    
    if (!userChat) {
      return res.json({
        success: true,
        data: { messages: [] }
      });
    }

    res.json({
      success: true,
      data: { messages: userChat.messages },
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// Create or update user chat
router.post("/user/message", async (req, res) => {
  const { userId, userName, text, senderType } = req.body;
  
  if (!userId || !text || !senderType) {
    return res.status(400).json({ 
      success: false, 
      msg: "userId, text, and senderType are required" 
    });
  }

  const newMessage = {
    messageId: uuidv4(),
    text,
    senderType, // 'user' or 'admin'
    timestamp: new Date(),
    readByAdmin: senderType === "admin" ? true : false
  };

  try {
    // Check if user chat exists
    const existingChat = await chatsCollection.findOne({ userId });
    
    if (existingChat) {
      // Update existing chat
      await chatsCollection.updateOne(
        { userId },
        {
          $push: { messages: newMessage },
          $set: { lastActivity: new Date() }
        }
      );
    } else {
      // Create new chat
      const newChat = {
        userId,
        userName: userName || `Guest_${userId.slice(-4)}`,
        messages: [newMessage],
        createdAt: new Date(),
        lastActivity: new Date()
      };
      
      await chatsCollection.insertOne(newChat);
    }

    res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// Mark messages as read by admin
router.patch("/admin/mark-read/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    await chatsCollection.updateOne(
      { userId },
      {
        $set: { "messages.$[].readByAdmin": true }
      }
    );

    res.json({
      success: true,
      msg: "Messages marked as read"
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// Delete a user chat
router.delete("/admin/chat/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    await chatsCollection.deleteOne({ userId });
    
    res.json({
      success: true,
      msg: "User chat deleted"
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// Get chat statistics (for admin dashboard)
router.get("/admin/stats", async (req, res) => {
  try {
    const totalChats = await chatsCollection.countDocuments();
    const activeToday = await chatsCollection.countDocuments({
      lastActivity: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    });

    // Count unread messages
    const chatsWithUnread = await chatsCollection.find({
      "messages.readByAdmin": false
    }).toArray();
    
    const totalUnreadMessages = chatsWithUnread.reduce((total, chat) => {
      const unreadCount = chat.messages.filter(msg => 
        msg.senderType === "user" && !msg.readByAdmin
      ).length;
      return total + unreadCount;
    }, 0);

    res.json({
      success: true,
      data: {
        totalChats,
        activeToday,
        totalUnreadMessages,
        chatsWithUnreadMessages: chatsWithUnread.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

module.exports = { router, setCollection };